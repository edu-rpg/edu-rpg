// Admin Dashboard Logic

let currentProfile = null;
let allValueTypes = [];
let selectedStudentId = null;
let selectedStudentName = null;

(async () => {
    currentProfile = await requireAuth(['admin']);
    if (!currentProfile) return;

    await loadPendingCount();
    await loadValueTypes();
    await loadStudents();
})();

// --- Pending Count ---
async function loadPendingCount() {
    const { count } = await db
        .from('daily_entries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    const badge = document.getElementById('pending-count');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    }
}

// --- Value Type Management ---
async function loadValueTypes() {
    const { data } = await db
        .from('value_types')
        .select('*')
        .order('id');

    allValueTypes = data || [];
    renderValueTypes();
}

function renderValueTypes() {
    const tbody = document.getElementById('value-types-body');
    tbody.innerHTML = '';

    allValueTypes.forEach(vt => {
        const row = document.createElement('tr');
        if (!vt.active) row.classList.add('inactive-row');
        row.innerHTML = `
            <td>${vt.name}</td>
            <td>
                <input type="number" value="${vt.points}" min="1" max="100"
                    class="input-small" onchange="updatePoints(${vt.id}, this.value)">%
            </td>
            <td>${vt.active ? '<span class="badge badge-approved">활성</span>' : '<span class="badge badge-pending">비활성</span>'}</td>
            <td>
                ${vt.active
                    ? `<button class="btn btn-small btn-danger" onclick="toggleValueType(${vt.id}, false)">비활성화</button>`
                    : `<button class="btn btn-small btn-primary" onclick="toggleValueType(${vt.id}, true)">활성화</button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

function showAddValueType() {
    document.getElementById('add-value-type-form').style.display = 'flex';
}

function hideAddValueType() {
    document.getElementById('add-value-type-form').style.display = 'none';
    document.getElementById('new-vt-name').value = '';
    document.getElementById('new-vt-points').value = '5';
}

async function addValueType() {
    const name = document.getElementById('new-vt-name').value.trim();
    const points = parseInt(document.getElementById('new-vt-points').value);

    if (!name) { alert('가치 이름을 입력하세요.'); return; }

    const { error } = await db
        .from('value_types')
        .insert({ name, points, active: true });

    if (error) { alert('추가 실패: ' + error.message); return; }

    hideAddValueType();
    await loadValueTypes();
}

async function updatePoints(id, newPoints) {
    await db
        .from('value_types')
        .update({ points: parseInt(newPoints) })
        .eq('id', id);
}

async function toggleValueType(id, active) {
    await db
        .from('value_types')
        .update({ active })
        .eq('id', id);

    await loadValueTypes();
}

// --- Students List ---
async function loadStudents() {
    const { data: students } = await db
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('name');

    const tbody = document.getElementById('students-body');
    tbody.innerHTML = '';

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">등록된 학생이 없습니다.</td></tr>';
        return;
    }

    for (const student of students) {
        const totalXP = await calculateStudentXP(student.id, student.name);
        const { level, remainder } = calculateLevel(totalXP);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="#" onclick="showStudentDetail('${student.id}', '${student.name}'); return false;">${student.name}</a></td>
            <td><span class="level-badge-small">Lv.${level}</span> ${remainder}%</td>
            <td>${totalXP}%</td>
            <td><button class="btn btn-small btn-secondary" onclick="showStudentDetail('${student.id}', '${student.name}')">상세보기</button></td>
        `;
        tbody.appendChild(row);
    }
}

function calculateLevel(totalXP) {
    const level = Math.floor(totalXP / 100) + 1;
    const remainder = totalXP % 100;
    return { level, remainder };
}

async function calculateStudentXP(studentId, studentName) {
    // Get approved entries
    const { data: entries } = await db
        .from('daily_entries')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'approved');

    if (!entries || entries.length === 0) return 0;

    let totalXP = 0;

    // Greetings + Assignments + Writing
    entries.forEach(e => {
        if (e.greetings) totalXP += 3;
        if (e.assignments > 0) totalXP += e.assignments * 5;
        if (e.writing_type === '5%') totalXP += 5;
        if (e.writing_type === '10%') totalXP += 10;
    });

    // Value stamps
    const entryIds = entries.map(e => e.id);
    const { data: stamps } = await db
        .from('entry_value_stamps')
        .select('points')
        .in('entry_id', entryIds);

    if (stamps) {
        stamps.forEach(s => totalXP += s.points);
    }

    // Titles
    const { data: titles } = await db
        .from('titles')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'approved');

    if (titles) {
        totalXP += titles.length * 20;
    }

    return totalXP;
}

// --- Student Detail ---
async function showStudentDetail(studentId, studentName) {
    selectedStudentId = studentId;
    selectedStudentName = studentName;
    document.getElementById('detail-student-name').textContent = studentName;
    document.getElementById('student-detail').style.display = 'block';

    // Set default date for admin entry form
    document.getElementById('admin-entry-date').value = new Date().toISOString().split('T')[0];

    // Load admin value stamp checkboxes
    const container = document.getElementById('admin-value-stamps');
    container.innerHTML = '';
    allValueTypes.filter(vt => vt.active).forEach(vt => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.innerHTML = `<input type="checkbox" name="admin-vt" value="${vt.id}" data-points="${vt.points}" data-name="${vt.name}"><span>${vt.name} (${vt.points}%)</span>`;
        container.appendChild(label);
    });

    await loadStudentEntries(studentId, studentName);

    // Scroll to detail
    document.getElementById('student-detail').scrollIntoView({ behavior: 'smooth' });
}

function hideStudentDetail() {
    document.getElementById('student-detail').style.display = 'none';
    selectedStudentId = null;
    selectedStudentName = null;
}

async function loadStudentEntries(studentId, studentName) {
    const { data: entries } = await db
        .from('daily_entries')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: true });

    const { data: stamps } = await db
        .from('entry_value_stamps')
        .select('*')
        .eq('student_name', studentName)
        .order('date');

    const { data: titles } = await db
        .from('titles')
        .select('*')
        .eq('student_id', studentId)
        .order('date_earned');

    // Build header
    const thead = document.getElementById('detail-table-head');
    thead.innerHTML = '<tr><th>날짜</th><th>인사</th>';
    allValueTypes.forEach(vt => {
        thead.innerHTML += `<th${!vt.active ? ' class="inactive-col"' : ''}>${vt.name}</th>`;
    });
    thead.innerHTML += '<th>과제</th><th>글쓰기</th><th>칭호</th><th>총 경험치</th><th>누적 경험치</th><th>상태</th></tr>';

    // Build rows
    const tbody = document.getElementById('detail-table-body');
    tbody.innerHTML = '';

    if (!entries || entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted">기록이 없습니다.</td></tr>';
        document.getElementById('detail-level-badge').textContent = 'Lv.1';
        document.getElementById('detail-xp-text').textContent = '0%';
        return;
    }

    let cumulativeXP = 0;

    entries.forEach(entry => {
        const row = document.createElement('tr');
        if (entry.status === 'pending') row.classList.add('pending-row');

        let dailyXP = 0;
        let cells = `<td>${entry.date}</td>`;

        // Greetings
        if (entry.greetings) { cells += '<td>3%</td>'; dailyXP += 3; }
        else { cells += '<td>-</td>'; }

        // Value stamps
        const entryStamps = (stamps || []).filter(s => s.entry_id === entry.id);
        allValueTypes.forEach(vt => {
            const stamp = entryStamps.find(s => s.value_type_id === vt.id);
            if (stamp) { cells += `<td>${stamp.points}%</td>`; dailyXP += stamp.points; }
            else { cells += '<td>-</td>'; }
        });

        // Assignments
        if (entry.assignments > 0) {
            const assignXP = entry.assignments * 5;
            cells += `<td>${entry.assignments}개 (${assignXP}%)</td>`;
            dailyXP += assignXP;
        } else {
            cells += '<td>-</td>';
        }

        // Writing
        if (entry.writing_type === '5%') { cells += '<td>5%</td>'; dailyXP += 5; }
        else if (entry.writing_type === '10%') { cells += '<td>10%</td>'; dailyXP += 10; }
        else { cells += '<td>-</td>'; }

        // Titles
        const entryTitles = (titles || []).filter(t => t.entry_id === entry.id);
        if (entryTitles.length > 0) {
            cells += `<td>${entryTitles.map(t => t.title_name).join(', ')} (${entryTitles.length * 20}%)</td>`;
            dailyXP += entryTitles.length * 20;
        } else {
            cells += '<td>-</td>';
        }

        cells += `<td>${dailyXP}%</td>`;

        if (entry.status === 'approved') cumulativeXP += dailyXP;
        cells += `<td>${cumulativeXP}%</td>`;

        cells += `<td>${entry.status === 'approved'
            ? '<span class="badge badge-approved">승인</span>'
            : '<span class="badge badge-pending">대기중</span>'}</td>`;

        row.innerHTML = cells;
        tbody.appendChild(row);
    });

    const { level, remainder } = calculateLevel(cumulativeXP);
    document.getElementById('detail-level-badge').textContent = 'Lv.' + level;
    document.getElementById('detail-xp-text').textContent = remainder + '%';
}

// --- Admin Add Entry ---
function showAddEntryForm() {
    document.getElementById('admin-add-entry').style.display = 'block';
}

function hideAddEntryForm() {
    document.getElementById('admin-add-entry').style.display = 'none';
}

async function submitAdminEntry() {
    if (!selectedStudentId) return;

    const date = document.getElementById('admin-entry-date').value;
    const greetings = document.getElementById('admin-greetings').checked;
    const assignments = parseInt(document.getElementById('admin-assignments').value) || 0;
    const writing = document.getElementById('admin-writing').value;
    const titleName = document.getElementById('admin-title-name').value.trim();

    // Insert entry as approved directly
    const { data: entry, error } = await db
        .from('daily_entries')
        .insert({
            student_id: selectedStudentId,
            date: date,
            greetings: greetings,
            assignments: assignments,
            writing_type: writing,
            status: 'approved'
        })
        .select()
        .single();

    if (error) { alert('추가 실패: ' + error.message); return; }

    // Value stamps
    const checkedStamps = document.querySelectorAll('input[name="admin-vt"]:checked');
    if (checkedStamps.length > 0) {
        const stampRecords = Array.from(checkedStamps).map(cb => ({
            entry_id: entry.id,
            value_type_id: parseInt(cb.value),
            date: date,
            student_name: selectedStudentName,
            value_name: cb.dataset.name,
            points: parseInt(cb.dataset.points)
        }));

        await db.from('entry_value_stamps').insert(stampRecords);
    }

    // Title
    if (titleName) {
        await db.from('titles').insert({
            student_id: selectedStudentId,
            entry_id: entry.id,
            title_name: titleName,
            date_earned: date,
            status: 'approved'
        });
    }

    // Check milestones
    await checkMilestones(selectedStudentId, selectedStudentName);

    // Reset form
    hideAddEntryForm();
    document.getElementById('admin-greetings').checked = false;
    document.getElementById('admin-assignments').value = '0';
    document.getElementById('admin-writing').value = 'none';
    document.getElementById('admin-title-name').value = '';
    document.querySelectorAll('input[name="admin-vt"]').forEach(cb => cb.checked = false);

    // Reload
    await loadStudentEntries(selectedStudentId, selectedStudentName);
    await loadStudents();
}
