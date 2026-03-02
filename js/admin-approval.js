// Admin Approval Page Logic

let currentProfile = null;
let allValueTypes = [];

(async () => {
    currentProfile = await requireAuth(['admin']);
    if (!currentProfile) return;

    await loadValueTypes();
    await loadPendingEntries();
})();

async function loadValueTypes() {
    const { data } = await db
        .from('value_types')
        .select('*')
        .order('id');

    allValueTypes = data || [];
}

async function loadPendingEntries() {
    const { data: entries } = await db
        .from('daily_entries')
        .select('*, profiles!daily_entries_student_id_fkey(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    const container = document.getElementById('pending-list');
    container.innerHTML = '';

    if (!entries || entries.length === 0) {
        document.getElementById('no-pending').style.display = 'block';
        return;
    }
    document.getElementById('no-pending').style.display = 'none';

    // Load stamps for all pending entries
    const entryIds = entries.map(e => e.id);
    const { data: stamps } = await db
        .from('entry_value_stamps')
        .select('*')
        .in('entry_id', entryIds);

    // Load pending titles
    const { data: titles } = await db
        .from('titles')
        .select('*')
        .in('entry_id', entryIds)
        .eq('status', 'pending');

    entries.forEach(entry => {
        const studentName = entry.profiles?.name || '알 수 없음';
        const entryStamps = (stamps || []).filter(s => s.entry_id === entry.id);
        const entryTitles = (titles || []).filter(t => t.entry_id === entry.id);

        let xpItems = [];
        let totalXP = 0;

        if (entry.greetings) {
            xpItems.push('인사 3%');
            totalXP += 3;
        }

        entryStamps.forEach(s => {
            xpItems.push(`${s.value_name} ${s.points}%`);
            totalXP += s.points;
        });

        if (entry.assignments > 0) {
            const assignXP = entry.assignments * 5;
            xpItems.push(`과제 ${entry.assignments}개 ${assignXP}%`);
            totalXP += assignXP;
        }

        if (entry.writing_type === '5%') {
            xpItems.push('감사 일기 5%');
            totalXP += 5;
        } else if (entry.writing_type === '10%') {
            xpItems.push('주제 글쓰기 10%');
            totalXP += 10;
        }

        entryTitles.forEach(t => {
            xpItems.push(`칭호 "${t.title_name}" 20%`);
            totalXP += 20;
        });

        const card = document.createElement('div');
        card.className = 'approval-card';
        card.id = `entry-card-${entry.id}`;
        card.innerHTML = `
            <div class="approval-header">
                <div>
                    <strong>${studentName}</strong>
                    <span class="text-muted">${entry.date}</span>
                </div>
                <div class="approval-total">합계: ${totalXP}%</div>
            </div>
            <div class="approval-items">
                ${xpItems.map(item => `<span class="xp-chip">${item}</span>`).join('')}
            </div>
            <div class="approval-actions">
                <button class="btn btn-small btn-primary" onclick="approveEntry(${entry.id})">승인</button>
                <button class="btn btn-small btn-secondary" onclick="openEditModal(${entry.id})">수정</button>
                <button class="btn btn-small btn-danger" onclick="rejectEntry(${entry.id})">거절</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function approveEntry(entryId) {
    const auditFields = { modified_at: getNowKST(), modified_by: currentProfile.id };

    // Approve entry
    await db
        .from('daily_entries')
        .update({ status: 'approved', ...auditFields })
        .eq('id', entryId);

    // Approve associated titles
    await db
        .from('titles')
        .update({ status: 'approved', ...auditFields })
        .eq('entry_id', entryId)
        .eq('status', 'pending');

    // Check milestones for this student
    const { data: entry } = await db
        .from('daily_entries')
        .select('student_id, profiles!daily_entries_student_id_fkey(name)')
        .eq('id', entryId)
        .single();

    if (entry) {
        await checkMilestones(entry.student_id, entry.profiles?.name || '');
    }

    // Remove card from UI
    const card = document.getElementById(`entry-card-${entryId}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => {
            card.remove();
            checkEmpty();
        }, 300);
    }
}

async function rejectEntry(entryId) {
    if (!confirm('이 항목을 거절하시겠습니까? 삭제됩니다.')) return;

    // Delete stamps
    await db.from('entry_value_stamps').delete().eq('entry_id', entryId);

    // Delete associated titles
    await db.from('titles').delete().eq('entry_id', entryId);

    // Delete entry
    await db.from('daily_entries').delete().eq('id', entryId);

    const card = document.getElementById(`entry-card-${entryId}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => {
            card.remove();
            checkEmpty();
        }, 300);
    }
}

async function approveAll() {
    if (!confirm('모든 대기 중인 항목을 승인하시겠습니까?')) return;

    // Get pending entries before approving (for milestone checks)
    const { data: pendingEntries } = await db
        .from('daily_entries')
        .select('student_id, profiles!daily_entries_student_id_fkey(name)')
        .eq('status', 'pending');

    const auditFields = { modified_at: getNowKST(), modified_by: currentProfile.id };

    await db
        .from('daily_entries')
        .update({ status: 'approved', ...auditFields })
        .eq('status', 'pending');

    await db
        .from('titles')
        .update({ status: 'approved', ...auditFields })
        .eq('status', 'pending');

    // Check milestones for each affected student
    if (pendingEntries) {
        const checked = new Set();
        for (const e of pendingEntries) {
            if (checked.has(e.student_id)) continue;
            checked.add(e.student_id);
            await checkMilestones(e.student_id, e.profiles?.name || '');
        }
    }

    await loadPendingEntries();
}

function checkEmpty() {
    const container = document.getElementById('pending-list');
    if (container.children.length === 0) {
        document.getElementById('no-pending').style.display = 'block';
    }
}

// --- Edit Modal ---
let editEntryData = null;

async function openEditModal(entryId) {
    const { data: entry } = await db
        .from('daily_entries')
        .select('*')
        .eq('id', entryId)
        .single();

    if (!entry) return;
    editEntryData = entry;

    document.getElementById('edit-entry-id').value = entryId;
    document.getElementById('edit-date').value = entry.date;
    document.getElementById('edit-greetings').checked = entry.greetings;
    document.getElementById('edit-assignments').value = entry.assignments || 0;
    document.getElementById('edit-writing').value = entry.writing_type;

    // Load stamps for this entry
    const { data: stamps } = await db
        .from('entry_value_stamps')
        .select('*')
        .eq('entry_id', entryId);

    const container = document.getElementById('edit-value-stamps');
    container.innerHTML = '';
    allValueTypes.filter(vt => vt.active).forEach(vt => {
        const checked = (stamps || []).some(s => s.value_type_id === vt.id);
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.innerHTML = `<input type="checkbox" name="edit-vt" value="${vt.id}" data-points="${vt.points}" data-name="${vt.name}" ${checked ? 'checked' : ''}><span>${vt.name} (${vt.points}%)</span>`;
        container.appendChild(label);
    });

    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    editEntryData = null;
}

async function saveEdit() {
    const entryId = parseInt(document.getElementById('edit-entry-id').value);
    const date = document.getElementById('edit-date').value;
    const greetings = document.getElementById('edit-greetings').checked;
    const assignments = parseInt(document.getElementById('edit-assignments').value) || 0;
    const writing = document.getElementById('edit-writing').value;

    const auditFields = { modified_at: getNowKST(), modified_by: currentProfile.id };

    // Update entry
    await db
        .from('daily_entries')
        .update({
            date: date,
            greetings: greetings,
            assignments: assignments,
            writing_type: writing,
            status: 'approved',
            ...auditFields
        })
        .eq('id', entryId);

    // Rebuild stamps: delete old, insert new
    await db.from('entry_value_stamps').delete().eq('entry_id', entryId);

    const checkedStamps = document.querySelectorAll('input[name="edit-vt"]:checked');
    if (checkedStamps.length > 0) {
        // Get student name
        const { data: entry } = await db
            .from('daily_entries')
            .select('student_id, profiles!daily_entries_student_id_fkey(name)')
            .eq('id', entryId)
            .single();

        const studentName = entry?.profiles?.name || '';

        const stampRecords = Array.from(checkedStamps).map(cb => ({
            entry_id: entryId,
            value_type_id: parseInt(cb.value),
            date: date,
            student_name: studentName,
            value_name: cb.dataset.name,
            points: parseInt(cb.dataset.points),
            ...auditFields
        }));

        await db.from('entry_value_stamps').insert(stampRecords);
    }

    // Approve associated titles
    await db
        .from('titles')
        .update({ status: 'approved' })
        .eq('entry_id', entryId)
        .eq('status', 'pending');

    // Check milestones
    if (editEntryData) {
        const studentName = entry?.profiles?.name || '';
        await checkMilestones(editEntryData.student_id, studentName);
    }

    closeEditModal();
    await loadPendingEntries();
}
