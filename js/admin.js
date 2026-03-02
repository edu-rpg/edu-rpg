// Admin Dashboard Logic

let currentProfile = null;
let allValueTypes = [];
let allPenaltyTypes = [];
let selectedStudentId = null;
let selectedStudentName = null;

(async () => {
    currentProfile = await requireAuth(['admin']);
    if (!currentProfile) return;

    await loadPendingCount();
    await loadValueTypes();
    await loadPenaltyTypes();
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

// --- Penalty Type Management ---
async function loadPenaltyTypes() {
    const { data } = await db
        .from('penalty_types')
        .select('*')
        .order('id');

    allPenaltyTypes = data || [];
    renderPenaltyTypes();
}

function renderPenaltyTypes() {
    const tbody = document.getElementById('penalty-types-body');
    tbody.innerHTML = '';

    allPenaltyTypes.forEach(pt => {
        const row = document.createElement('tr');
        if (!pt.active) row.classList.add('inactive-row');
        row.innerHTML = `
            <td>${pt.name}</td>
            <td>
                <input type="number" value="${pt.percent}" min="1" max="100"
                    class="input-small" onchange="updatePenaltyPercent(${pt.id}, this.value)">%
            </td>
            <td>${pt.is_lateness ? '✓' : '-'}</td>
            <td>${pt.is_rebel ? '✓' : '-'}</td>
            <td>${pt.active ? '<span class="badge badge-approved">활성</span>' : '<span class="badge badge-pending">비활성</span>'}</td>
            <td>
                ${pt.active
                    ? `<button class="btn btn-small btn-danger" onclick="togglePenaltyType(${pt.id}, false)">비활성화</button>`
                    : `<button class="btn btn-small btn-primary" onclick="togglePenaltyType(${pt.id}, true)">활성화</button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

function showAddPenaltyType() {
    document.getElementById('add-penalty-type-form').style.display = 'flex';
}

function hideAddPenaltyType() {
    document.getElementById('add-penalty-type-form').style.display = 'none';
    document.getElementById('new-pt-name').value = '';
    document.getElementById('new-pt-percent').value = '5';
    document.getElementById('new-pt-lateness').checked = false;
    document.getElementById('new-pt-rebel').checked = false;
}

async function addPenaltyType() {
    const name = document.getElementById('new-pt-name').value.trim();
    const percent = parseInt(document.getElementById('new-pt-percent').value);
    const is_lateness = document.getElementById('new-pt-lateness').checked;
    const is_rebel = document.getElementById('new-pt-rebel').checked;

    if (!name) { alert('감점 이름을 입력하세요.'); return; }

    const { error } = await db
        .from('penalty_types')
        .insert({ name, percent, is_lateness, is_rebel, active: true });

    if (error) { alert('추가 실패: ' + error.message); return; }

    hideAddPenaltyType();
    await loadPenaltyTypes();
}

async function updatePenaltyPercent(id, newPercent) {
    await db
        .from('penalty_types')
        .update({ percent: parseInt(newPercent) })
        .eq('id', id);
}

async function togglePenaltyType(id, active) {
    await db
        .from('penalty_types')
        .update({ active })
        .eq('id', id);

    await loadPenaltyTypes();
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

    // Subtract penalties
    const { data: penalties } = await db
        .from('penalties')
        .select('xp_deducted')
        .eq('student_id', studentId);

    if (penalties) {
        penalties.forEach(p => totalXP -= p.xp_deducted);
    }

    return Math.max(0, totalXP);
}

// --- Student Detail ---
async function showStudentDetail(studentId, studentName) {
    selectedStudentId = studentId;
    selectedStudentName = studentName;
    document.getElementById('detail-student-name').textContent = studentName;
    document.getElementById('student-detail').style.display = 'block';

    // Set default date for admin entry form
    document.getElementById('admin-entry-date').value = getTodayISO();

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

    const { data: penalties } = await db
        .from('penalties')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: true });

    // Build header
    const thead = document.getElementById('detail-table-head');
    const colCount = allValueTypes.length + 8; // date + greetings + valueTypes + assignments + writing + titles + totalXP + cumXP + status
    let headerHTML = '<tr><th>날짜</th><th>인사</th>';
    allValueTypes.forEach(vt => {
        headerHTML += `<th${!vt.active ? ' class="inactive-col"' : ''}>${vt.name}</th>`;
    });
    headerHTML += '<th>과제</th><th>글쓰기</th><th>칭호</th><th>총 경험치</th><th>누적 경험치</th><th>상태</th></tr>';
    thead.innerHTML = headerHTML;

    // Build rows
    const tbody = document.getElementById('detail-table-body');
    tbody.innerHTML = '';

    const hasEntries = entries && entries.length > 0;
    const hasPenalties = penalties && penalties.length > 0;

    if (!hasEntries && !hasPenalties) {
        tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted">기록이 없습니다.</td></tr>';
        document.getElementById('detail-level-badge').textContent = 'Lv.1';
        document.getElementById('detail-xp-text').textContent = '0%';
        return;
    }

    // Build chronological timeline merging entries and penalties
    const timeline = [];
    if (hasEntries) {
        entries.forEach(e => timeline.push({ type: 'entry', date: e.date, created_at: e.created_at, data: e }));
    }
    if (hasPenalties) {
        penalties.forEach(p => timeline.push({ type: 'penalty', date: p.date, created_at: p.created_at, data: p }));
    }
    timeline.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.created_at || '').localeCompare(b.created_at || '');
    });

    let cumulativeXP = 0;

    timeline.forEach(item => {
        if (item.type === 'entry') {
            const entry = item.data;
            const row = document.createElement('tr');
            if (entry.status === 'pending') row.classList.add('pending-row');

            let dailyXP = 0;
            let cells = `<td>${entry.date}</td>`;

            if (entry.greetings) { cells += '<td>3%</td>'; dailyXP += 3; }
            else { cells += '<td>-</td>'; }

            const entryStamps = (stamps || []).filter(s => s.entry_id === entry.id);
            allValueTypes.forEach(vt => {
                const stamp = entryStamps.find(s => s.value_type_id === vt.id);
                if (stamp) { cells += `<td>${stamp.points}%</td>`; dailyXP += stamp.points; }
                else { cells += '<td>-</td>'; }
            });

            if (entry.assignments > 0) {
                const assignXP = entry.assignments * 5;
                cells += `<td>${entry.assignments}개 (${assignXP}%)</td>`;
                dailyXP += assignXP;
            } else { cells += '<td>-</td>'; }

            if (entry.writing_type === '5%') { cells += '<td>5%</td>'; dailyXP += 5; }
            else if (entry.writing_type === '10%') { cells += '<td>10%</td>'; dailyXP += 10; }
            else { cells += '<td>-</td>'; }

            const entryTitles = (titles || []).filter(t => t.entry_id === entry.id);
            if (entryTitles.length > 0) {
                cells += `<td>${entryTitles.map(t => t.title_name).join(', ')} (${entryTitles.length * 20}%)</td>`;
                dailyXP += entryTitles.length * 20;
            } else { cells += '<td>-</td>'; }

            cells += `<td>${dailyXP}%</td>`;
            if (entry.status === 'approved') cumulativeXP += dailyXP;
            cells += `<td>${cumulativeXP}%</td>`;
            cells += `<td>${entry.status === 'approved'
                ? '<span class="badge badge-approved">승인</span>'
                : '<span class="badge badge-pending">대기중</span>'}</td>`;

            row.innerHTML = cells;
            tbody.appendChild(row);
        } else {
            // Penalty row
            const p = item.data;
            const row = document.createElement('tr');
            row.classList.add('penalty-row');

            const midCols = allValueTypes.length + 4; // greetings + valueTypes + assignments + writing + titles
            const noteText = p.note ? ` (${p.note})` : '';
            let cells = `<td>${p.date}</td>`;
            cells += `<td colspan="${midCols}" class="penalty-label">⚠️ ${p.penalty_type_name}${noteText}</td>`;
            cells += `<td class="penalty-xp">-${p.xp_deducted}%</td>`;
            cumulativeXP -= p.xp_deducted;
            if (cumulativeXP < 0) cumulativeXP = 0;
            cells += `<td>${cumulativeXP}%</td>`;
            cells += `<td><span class="badge badge-danger">감점</span></td>`;

            row.innerHTML = cells;
            tbody.appendChild(row);
        }
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
            status: 'approved',
            modified_at: getNowKST(),
            modified_by: currentProfile.id
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
            points: parseInt(cb.dataset.points),
            modified_at: getNowKST(),
            modified_by: currentProfile.id
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
            status: 'approved',
            modified_at: getNowKST(),
            modified_by: currentProfile.id
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

// --- Penalty Application ---
function showPenaltySection() {
    hidePenaltySection();
    const select = document.getElementById('penalty-type-select');
    select.innerHTML = '<option value="">선택하세요</option>';
    allPenaltyTypes.filter(pt => pt.active).forEach(pt => {
        select.innerHTML += `<option value="${pt.id}" data-percent="${pt.percent}" data-lateness="${pt.is_lateness}" data-rebel="${pt.is_rebel}">${pt.name} (${pt.percent}%)</option>`;
    });
    document.getElementById('penalty-count').value = '1';
    document.getElementById('penalty-section').style.display = 'flex';
}

function hidePenaltySection() {
    document.getElementById('penalty-section').style.display = 'none';
    document.getElementById('penalty-preview').style.display = 'none';
    document.getElementById('lateness-group').style.display = 'none';
}

function onPenaltyTypeChange() {
    const select = document.getElementById('penalty-type-select');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) {
        document.getElementById('lateness-group').style.display = 'none';
        document.getElementById('penalty-preview').style.display = 'none';
        return;
    }

    const isLateness = opt.dataset.lateness === 'true';
    const isRebel = opt.dataset.rebel === 'true';

    document.getElementById('lateness-group').style.display = isLateness ? 'block' : 'none';

    if (isRebel) {
        document.getElementById('penalty-count').value = '1';
        document.getElementById('penalty-count').disabled = true;
    } else {
        document.getElementById('penalty-count').disabled = false;
    }

    updatePenaltyPreview();
}

async function updatePenaltyPreview() {
    const select = document.getElementById('penalty-type-select');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) return;

    const isRebel = opt.dataset.rebel === 'true';
    const isLateness = opt.dataset.lateness === 'true';
    const basePercent = parseInt(opt.dataset.percent);
    const count = isRebel ? 1 : (parseInt(document.getElementById('penalty-count').value) || 1);

    if (isRebel) {
        document.getElementById('penalty-preview-text').innerHTML = '<strong>반역: 현재 경험치 전액 몰수</strong>';
        document.getElementById('penalty-preview').style.display = 'block';
        return;
    }

    let effectivePercent = basePercent;
    if (isLateness) {
        const minutes = parseInt(document.getElementById('lateness-minutes').value) || 10;
        effectivePercent = (minutes / 10) * basePercent;
    }

    const currentXP = await calculateStudentXP(selectedStudentId, selectedStudentName);
    let remaining = currentXP;
    let totalDeducted = 0;

    for (let i = 0; i < count; i++) {
        const deduction = Math.floor(remaining * effectivePercent / 100);
        totalDeducted += deduction;
        remaining -= deduction;
        if (remaining <= 0) { remaining = 0; break; }
    }

    document.getElementById('penalty-preview-text').innerHTML =
        `현재 경험치: ${currentXP}% → ${count}회 적용 시 총 <strong>-${totalDeducted}%</strong> (잔여: ${remaining}%)`;
    document.getElementById('penalty-preview').style.display = 'block';
}

async function applyPenalty() {
    if (!selectedStudentId) return;

    const select = document.getElementById('penalty-type-select');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) { alert('감점 종류를 선택하세요.'); return; }

    const penaltyTypeId = parseInt(opt.value);
    const penaltyTypeName = opt.textContent.split(' (')[0];
    const basePercent = parseInt(opt.dataset.percent);
    const isRebel = opt.dataset.rebel === 'true';
    const isLateness = opt.dataset.lateness === 'true';
    const count = isRebel ? 1 : (parseInt(document.getElementById('penalty-count').value) || 1);

    let effectivePercent = basePercent;
    let note = null;
    if (isLateness) {
        const minutes = parseInt(document.getElementById('lateness-minutes').value) || 10;
        effectivePercent = (minutes / 10) * basePercent;
        note = `${minutes}분 지각`;
    }

    const currentXP = await calculateStudentXP(selectedStudentId, selectedStudentName);
    let remaining = currentXP;
    const penaltyRecords = [];

    if (isRebel) {
        penaltyRecords.push({
            student_id: selectedStudentId,
            penalty_type_id: penaltyTypeId,
            penalty_type_name: penaltyTypeName,
            penalty_percent: 100,
            xp_before: remaining,
            xp_deducted: remaining,
            note: '경험치 전액 몰수',
            date: getTodayISO(),
            modified_at: getNowKST(),
            modified_by: currentProfile.id
        });
    } else {
        for (let i = 0; i < count; i++) {
            const deduction = Math.floor(remaining * effectivePercent / 100);
            if (deduction <= 0 && remaining <= 0) break;
            penaltyRecords.push({
                student_id: selectedStudentId,
                penalty_type_id: penaltyTypeId,
                penalty_type_name: penaltyTypeName,
                penalty_percent: effectivePercent,
                xp_before: remaining,
                xp_deducted: deduction,
                note: note,
                date: getTodayISO(),
                modified_at: getNowKST(),
                modified_by: currentProfile.id
            });
            remaining -= deduction;
            if (remaining <= 0) { remaining = 0; break; }
        }
    }

    const totalDeducted = penaltyRecords.reduce((sum, p) => sum + p.xp_deducted, 0);
    const confirmMsg = isRebel
        ? `반역: 현재 경험치 ${currentXP}% 전액 몰수합니다. 진행하시겠습니까?`
        : `${penaltyTypeName} ${count}회 적용: 총 -${totalDeducted}% (${currentXP}% → ${currentXP - totalDeducted}%). 진행하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    const { error } = await db.from('penalties').insert(penaltyRecords);
    if (error) { alert('감점 적용 실패: ' + error.message); return; }

    hidePenaltySection();
    await loadStudentEntries(selectedStudentId, selectedStudentName);
    await loadStudents();
}
