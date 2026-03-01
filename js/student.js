// Student Progress Page Logic

let currentProfile = null;

(async () => {
    currentProfile = await requireAuth(['student']);
    if (!currentProfile) return;

    document.getElementById('user-name').textContent = currentProfile.name;
    await loadProgressTable();
})();

function calculateLevel(totalXP) {
    const level = Math.floor(totalXP / 100) + 1;
    const remainder = totalXP % 100;
    return { level, remainder };
}

async function loadProgressTable() {
    // Load active value types for column headers
    const { data: valueTypes } = await db
        .from('value_types')
        .select('*')
        .order('id');

    // Build table header with dynamic value type columns
    const thead = document.getElementById('xp-table-head');
    const headerRow = thead.querySelector('tr');
    // Clear and rebuild
    headerRow.innerHTML = '';
    headerRow.innerHTML = '<th>날짜</th><th>인사</th>';

    // All value types (including inactive) for column display
    const allValueTypes = valueTypes || [];
    allValueTypes.forEach(vt => {
        const th = document.createElement('th');
        th.textContent = vt.name;
        if (!vt.active) th.classList.add('inactive-col');
        headerRow.appendChild(th);
    });

    headerRow.innerHTML += '<th>과제</th><th>글쓰기</th><th>칭호</th><th>총 경험치</th><th>누적 경험치</th><th>상태</th>';

    // Load entries
    const { data: entries } = await db
        .from('daily_entries')
        .select('*')
        .eq('student_id', currentProfile.id)
        .order('date', { ascending: true });

    // Load value stamps for this student
    const { data: stamps } = await db
        .from('entry_value_stamps')
        .select('*')
        .eq('student_name', currentProfile.name)
        .order('date', { ascending: true });

    // Load titles for this student
    const { data: titles } = await db
        .from('titles')
        .select('*')
        .eq('student_id', currentProfile.id)
        .order('date_earned', { ascending: true });

    const tbody = document.getElementById('xp-table-body');
    tbody.innerHTML = '';

    if (!entries || entries.length === 0) {
        document.getElementById('no-data').style.display = 'block';
        return;
    }

    let cumulativeXP = 0;

    entries.forEach(entry => {
        const row = document.createElement('tr');
        if (entry.status === 'pending') row.classList.add('pending-row');

        let dailyXP = 0;

        // Date
        const dateCell = document.createElement('td');
        dateCell.textContent = entry.date;
        row.appendChild(dateCell);

        // Greetings (3%)
        const greetCell = document.createElement('td');
        if (entry.greetings) {
            greetCell.textContent = '3%';
            dailyXP += 3;
        } else {
            greetCell.textContent = '-';
        }
        row.appendChild(greetCell);

        // Value stamps (dynamic columns)
        const entryStamps = (stamps || []).filter(s => s.entry_id === entry.id);
        allValueTypes.forEach(vt => {
            const stampCell = document.createElement('td');
            const stamp = entryStamps.find(s => s.value_type_id === vt.id);
            if (stamp) {
                stampCell.textContent = stamp.points + '%';
                dailyXP += stamp.points;
            } else {
                stampCell.textContent = '-';
            }
            row.appendChild(stampCell);
        });

        // Assignments
        const assignCell = document.createElement('td');
        if (entry.assignments > 0) {
            const assignXP = entry.assignments * 5;
            assignCell.textContent = `${entry.assignments}개 (${assignXP}%)`;
            dailyXP += assignXP;
        } else {
            assignCell.textContent = '-';
        }
        row.appendChild(assignCell);

        // Writing
        const writeCell = document.createElement('td');
        if (entry.writing_type === '5%') {
            writeCell.textContent = '5%';
            dailyXP += 5;
        } else if (entry.writing_type === '10%') {
            writeCell.textContent = '10%';
            dailyXP += 10;
        } else {
            writeCell.textContent = '-';
        }
        row.appendChild(writeCell);

        // Titles (20% each)
        const titleCell = document.createElement('td');
        const entryTitles = (titles || []).filter(t => t.entry_id === entry.id);
        if (entryTitles.length > 0) {
            const titleNames = entryTitles.map(t => t.title_name);
            titleCell.textContent = titleNames.join(', ') + ' (' + (entryTitles.length * 20) + '%)';
            dailyXP += entryTitles.length * 20;
        } else {
            titleCell.textContent = '-';
        }
        row.appendChild(titleCell);

        // Daily total
        const totalCell = document.createElement('td');
        totalCell.textContent = dailyXP + '%';
        row.appendChild(totalCell);

        // Cumulative (only count approved entries)
        if (entry.status === 'approved') {
            cumulativeXP += dailyXP;
        }
        const cumCell = document.createElement('td');
        cumCell.textContent = cumulativeXP + '%';
        row.appendChild(cumCell);

        // Status
        const statusCell = document.createElement('td');
        if (entry.status === 'approved') {
            statusCell.innerHTML = '<span class="badge badge-approved">승인</span>';
        } else {
            statusCell.innerHTML = '<span class="badge badge-pending">대기중</span>';
        }
        row.appendChild(statusCell);

        tbody.appendChild(row);
    });

    // Update level display
    const { level, remainder } = calculateLevel(cumulativeXP);
    document.getElementById('level-badge').textContent = 'Lv.' + level;
    document.getElementById('xp-bar').style.width = remainder + '%';
    document.getElementById('xp-text').textContent = remainder + '%';
}
