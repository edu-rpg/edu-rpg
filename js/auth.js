// Auth utilities

// Check if user is logged in and get their profile
async function getProfile() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;

    const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return profile;
}

// Route guard: redirect if not logged in or wrong role
async function requireAuth(allowedRoles) {
    const profile = await getProfile();
    if (!profile) {
        window.location.href = 'index.html';
        return null;
    }
    if (allowedRoles && !allowedRoles.includes(profile.role)) {
        if (profile.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'student.html';
        }
        return null;
    }

    // Initialize notification bell if present
    if (typeof initNotificationBell === 'function') {
        await initNotificationBell();
    }

    return profile;
}

// Logout
async function logout() {
    await db.auth.signOut();
    window.location.href = 'index.html';
}

// Login page logic
if (document.getElementById('login-form')) {
    // If already logged in, redirect
    (async () => {
        const profile = await getProfile();
        if (profile) {
            window.location.href = profile.role === 'admin' ? 'admin.html' : 'student.html';
        }
    })();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.style.display = 'none';

        const { data, error } = await db.auth.signInWithPassword({ email, password });

        if (error) {
            errorEl.textContent = '로그인에 실패했습니다. 아이디와 비밀번호를 확인하세요.';
            errorEl.style.display = 'block';
            return;
        }

        const profile = await getProfile();
        if (profile) {
            window.location.href = profile.role === 'admin' ? 'admin.html' : 'student.html';
        } else {
            errorEl.textContent = '프로필 정보를 찾을 수 없습니다.';
            errorEl.style.display = 'block';
        }
    });
}
