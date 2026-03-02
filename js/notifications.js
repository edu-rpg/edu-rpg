// Notification system: milestone checks + bell UI

// --- Milestone check ---
// Called after an entry becomes approved (approve, edit-approve, admin direct add)
async function checkMilestones(studentId, studentName) {
    // Get all approved entries for this student
    const { data: entries } = await db
        .from('daily_entries')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'approved');

    if (!entries || entries.length === 0) return;

    const entryIds = entries.map(e => e.id);

    // Get all value stamps for approved entries
    const { data: stamps } = await db
        .from('entry_value_stamps')
        .select('value_type_id, value_name, count')
        .in('entry_id', entryIds);

    if (!stamps || stamps.length === 0) return;

    // Count stamps per value_type_id (using stamp count)
    const countMap = {};
    const nameMap = {};
    stamps.forEach(s => {
        countMap[s.value_type_id] = (countMap[s.value_type_id] || 0) + (s.count || 1);
        nameMap[s.value_type_id] = s.value_name;
    });

    // Get existing notifications for this student to avoid duplicates
    const { data: existing } = await db
        .from('notifications')
        .select('value_type_name, milestone_level')
        .eq('student_id', studentId);

    const existingSet = new Set(
        (existing || []).map(n => `${n.value_type_name}_${n.milestone_level}`)
    );

    // Get admin user id
    const { data: admins } = await db
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

    const adminId = admins && admins.length > 0 ? admins[0].id : null;

    // Check each value type for milestone crossings
    const notifications = [];
    for (const [vtId, count] of Object.entries(countMap)) {
        const valueName = nameMap[vtId];
        // Check every 10-stamp milestone
        const maxLevel = Math.floor(count / 10);
        for (let level = 1; level <= maxLevel; level++) {
            const key = `${valueName}_${level}`;
            if (existingSet.has(key)) continue;

            // Student notification
            notifications.push({
                recipient_id: studentId,
                student_id: studentId,
                value_type_name: valueName,
                milestone_level: level,
                message: `${valueName} ${level}단계 칭호 획득!!`
            });

            // Admin notification
            if (adminId) {
                notifications.push({
                    recipient_id: adminId,
                    student_id: studentId,
                    value_type_name: valueName,
                    milestone_level: level,
                    message: `${studentName} ${valueName} ${level}단계 칭호 획득`
                });
            }
        }
    }

    if (notifications.length > 0) {
        await db.from('notifications').insert(notifications);
    }
}

// --- Notification Bell UI ---
let notifDropdownOpen = false;

async function initNotificationBell() {
    const bellBtn = document.getElementById('notif-bell');
    const dropdown = document.getElementById('notif-dropdown');
    if (!bellBtn || !dropdown) return;

    // Get current user id for filtering
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    window._notifUserId = user.id;

    await refreshNotifBadge();

    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdownOpen = !notifDropdownOpen;
        if (notifDropdownOpen) {
            dropdown.classList.add('open');
            loadNotifications();
        } else {
            dropdown.classList.remove('open');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (notifDropdownOpen) {
            notifDropdownOpen = false;
            dropdown.classList.remove('open');
        }
    });

    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

async function refreshNotifBadge() {
    const badge = document.getElementById('notif-count');
    console.log("refreshNotifBadge initialized");
    console.log(window._notifUserId);
    if (!badge || !window._notifUserId) return;

    const { count } = await db
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', window._notifUserId)
        .eq('status', 'sent');
    console.log(count);

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

async function loadNotifications() {
    const list = document.getElementById('notif-list');
    if (!list || !window._notifUserId) return;

    const { data } = await db
        .from('notifications')
        .select('*')
        .eq('recipient_id', window._notifUserId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (!data || data.length === 0) {
        list.innerHTML = '<div class="notif-empty">알림이 없습니다.</div>';
        return;
    }

    list.innerHTML = data.map(n => {
        const time = new Date(n.created_at).toLocaleDateString('ko-KR', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const unread = n.status === 'sent' ? 'unread' : '';
        const readBtn = n.status === 'sent'
            ? `<button class="notif-read-btn" onclick="markAsRead(${n.id})">읽음</button>`
            : '';
        return `
            <div class="notif-item ${unread}" id="notif-${n.id}">
                <div class="notif-content">
                    <div class="notif-msg">${n.message}</div>
                    <div class="notif-time">${time}</div>
                </div>
                ${readBtn}
            </div>
        `;
    }).join('');
}

async function markAsRead(notifId) {
    await db
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notifId);

    const item = document.getElementById(`notif-${notifId}`);
    if (item) {
        item.classList.remove('unread');
        const btn = item.querySelector('.notif-read-btn');
        if (btn) btn.remove();
    }

    await refreshNotifBadge();
}
