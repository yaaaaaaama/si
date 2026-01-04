// Supabase対応データ管理
class DataManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
          this.goals = {}; 
    }

    async initialize() {
        // 現在のユーザーセッションを確認
        this.currentUser = await SupabaseAuth.getCurrentUser();
        if (this.currentUser) {
            this.userProfile = await SupabaseDB.getProfile(this.currentUser.id);
        }
        return !!this.currentUser;
    }

    // ユーザー認証
    async registerUser(email, password, nickname, username) {
        const result = await SupabaseAuth.signUp(email, password, nickname, username);
        
        if (result.success) {
            this.currentUser = result.user;
            // プロフィール取得（少し待つ）
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.userProfile = await SupabaseDB.getProfile(result.user.id);
        }
        
        return result;
    }

    async loginUser(email, password) {
        const result = await SupabaseAuth.signIn(email, password);
        
        if (result.success) {
            this.currentUser = result.user;
            this.userProfile = await SupabaseDB.getProfile(result.user.id);
        }
        
        return result;
    }

    async logoutUser() {
        await SupabaseAuth.signOut();
        this.currentUser = null;
        this.userProfile = null;
    }

    // カテゴリ管理
    async addCategory(name) {
        try {
            await SupabaseDB.addCategory(name);
            return true;
        } catch (error) {
            console.error('Add category error:', error);
            return false;
        }
    }

    async getCategories() {
        try {
            const categories = await SupabaseDB.getCategories();
            return categories.map(c => c.name);
        } catch (error) {
            console.error('Get categories error:', error);
            return [];
        }
    }

    // 記録管理
    async addRecord(category, minutes, text = '', isPublic = true) {
        try {
            await SupabaseDB.addRecord(category, minutes, text, isPublic);
            return true;
        } catch (error) {
            console.error('Add record error:', error);
            return false;
        }
    }

    async getTodayRecords() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return await window.SupabaseDB.getMyRecords(start.toISOString(), end.toISOString());
    }

    async getWeekRecords() {
    const now = new Date();

    // 月曜=0, 日曜=6 に変換
    const day = (now.getDay() + 6) % 7;

    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return await window.SupabaseDB.getMyRecords(start.toISOString(), end.toISOString());
    }

    async getStreak() {
        try {
            const records = await SupabaseDB.getMyRecords();
            
            if (records.length === 0) return 0;
            
            const dates = [...new Set(records.map(r => new Date(r.created_at).toDateString()))];
            dates.sort((a, b) => new Date(b) - new Date(a));
            
            let streak = 0;
            let currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            
            for (let date of dates) {
                const recordDate = new Date(date);
                const diffDays = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                
                if (diffDays === streak) {
                    streak++;
                } else {
                    break;
                }
            }
            
            return streak;
        } catch (error) {
            console.error('Get streak error:', error);
            return 0;
        }
    }

    // 目標管理
    async setGoal(category, hours) {
        try {
            await SupabaseDB.setGoal(category, hours);
            return true;
        } catch (error) {
            console.error('Set goal error:', error);
            return false;
        }
    }

    async getGoals() {
        try {
            const goals = await SupabaseDB.getGoals();
            const goalsObj = {};
            goals.forEach(g => {
                goalsObj[g.category] = g.hours;
            });
            return goalsObj;
        } catch (error) {
            console.error('Get goals error:', error);
            return {};
        }
    }

    // SNS機能
    async getPosts(filter = 'recommended') {
        try {
            const posts = await SupabaseDB.getPosts(filter);
            
            // データを変換
            return posts.map(post => ({
                id: post.id,
                userId: post.user_id,
                userName: post.profiles.nickname,
                username: post.profiles.username,
                category: post.records.category,
                minutes: post.records.minutes,
                text: post.records.text,
                streak: 0, // TODO: 各ユーザーのstreakを取得
                likes: post.likes,
                commentsCount: post.commentsCount,
                timestamp: new Date(post.created_at).getTime(),
                isLiked: post.isLiked,
                isMyPost: post.isMyPost,
                comments: []
            }));
        } catch (error) {
            console.error('Get posts error:', error);
            return [];
        }
    }

    async toggleLike(postId) {
        try {
            await SupabaseDB.toggleLike(postId);
            return true;
        } catch (error) {
            console.error('Toggle like error:', error);
            return false;
        }
    }

    async addComment(postId, text) {
        try {
            await SupabaseDB.addComment(postId, text);
            return true;
        } catch (error) {
            console.error('Add comment error:', error);
            return false;
        }
    }

    async getComments(postId) {
        try {
            const comments = await SupabaseDB.getComments(postId);
            return comments.map(c => ({
                userId: c.profiles.id,
                userName: c.profiles.nickname,
                text: c.text,
                timestamp: new Date(c.created_at).getTime()
            }));
        } catch (error) {
            console.error('Get comments error:', error);
            return [];
        }
    }

    async toggleFollow(userId) {
        try {
            await SupabaseDB.toggleFollow(userId);
            return true;
        } catch (error) {
            console.error('Toggle follow error:', error);
            return false;
        }
    }
}

// ストップウォッチ管理（変更なし）
class Stopwatch {
    constructor() {
        this.startTime = null;
        this.elapsedTime = 0;
        this.timerInterval = null;
        this.isRunning = false;
    }

    start() {
        this.startTime = Date.now() - this.elapsedTime;
        this.isRunning = true;
        this.timerInterval = setInterval(() => this.update(), 100);
    }

    pause() {
        clearInterval(this.timerInterval);
        this.isRunning = false;
    }

    stop() {
        clearInterval(this.timerInterval);
        const minutes = Math.ceil(this.elapsedTime / 60000);
        this.reset();
        return minutes;
    }

    reset() {
        this.startTime = null;
        this.elapsedTime = 0;
        this.isRunning = false;
    }

    update() {
        this.elapsedTime = Date.now() - this.startTime;
        this.display();
    }

    display() {
        const totalSeconds = Math.floor(this.elapsedTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('stopwatch').textContent = formatted;
    }

    getMinutes() {
        return Math.ceil(this.elapsedTime / 60000);
    }
}

// アプリケーション（続く）
// アプリケーション
class App {
    constructor() {
        this.dataManager = new DataManager();
        this.stopwatch = new Stopwatch();
        this.chart = null;
        this.currentPostId = null;
        this.init();
    }

    async init() {
    // 先にイベントを登録（初期化が失敗してもタブ切替などが動く）
    this.setupEventListeners();

    try {
        const isLoggedIn = await this.dataManager.initialize();
        if (isLoggedIn) {
        this.showApp();
        } else {
        this.showLogin();
        }
    } catch (e) {
        console.error('Initialize error:', e);
        this.showLogin();
    }
    }

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        this.updateUI();
    }

    setupEventListeners() {
        // 認証タブ切り替え
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                
                tab.classList.add('active');
                const formId = tab.dataset.tab === 'login' ? 'login-form' : 'register-form';
                document.getElementById(formId).classList.add('active');
                
                // エラーメッセージをクリア
                document.getElementById('login-error').textContent = '';
                document.getElementById('register-error').textContent = '';
            });
        });

        // ログイン
        document.getElementById('login-submit-btn').addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                document.getElementById('login-error').textContent = 'すべての項目を入力してください';
                return;
            }
            
            const result = await this.dataManager.loginUser(email, password);
            if (result.success) {
                this.showApp();
            } else {
                document.getElementById('login-error').textContent = result.error || 'ログインに失敗しました';
            }
        });

        // 新規登録
        document.getElementById('register-submit-btn').addEventListener('click', async () => {
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const passwordConfirm = document.getElementById('register-password-confirm').value;
            const nickname = document.getElementById('register-nickname').value.trim();
            const username = document.getElementById('register-username').value.trim();
            
            const errorElement = document.getElementById('register-error');
            errorElement.textContent = '';
            
            // バリデーション
            if (!email || !password || !passwordConfirm || !nickname || !username) {
                errorElement.textContent = 'すべての項目を入力してください';
                return;
            }
            
            if (password.length < 8) {
                errorElement.textContent = 'パスワードは8文字以上で入力してください';
                return;
            }
            
            if (password !== passwordConfirm) {
                errorElement.textContent = 'パスワードが一致しません';
                return;
            }
            
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                errorElement.textContent = 'ユーザー名は半角英数字とアンダースコアのみ使用できます';
                return;
            }
            
            const result = await this.dataManager.registerUser(email, password, nickname, username);
            if (result.success) {
                this.showApp();
            } else {
                errorElement.textContent = result.error || '登録に失敗しました';
            }
        });

        // ストップウォッチ
        document.getElementById('start-btn').addEventListener('click', () => {
            if (!this.stopwatch.isRunning) {
                this.stopwatch.start();
                document.getElementById('start-btn').textContent = '一時停止';
                document.getElementById('start-btn').classList.add('paused');
                document.getElementById('stop-btn').disabled = false;
            } else {
                this.stopwatch.pause();
                document.getElementById('start-btn').textContent = '再開';
            }
        });

        document.getElementById('stop-btn').addEventListener('click', () => {
            const minutes = this.stopwatch.getMinutes();
            if (minutes > 0) {
                this.showCategoryModal(minutes);
            }
            this.stopwatch.stop();
            this.stopwatch.display();
            document.getElementById('start-btn').textContent = '開始';
            document.getElementById('start-btn').classList.remove('paused');
            document.getElementById('stop-btn').disabled = true;
        });

        // カテゴリ選択
        document.getElementById('add-category-btn').addEventListener('click', async () => {
            const name = document.getElementById('new-category-input').value.trim();
            if (name) {
                await this.dataManager.addCategory(name);
                await this.updateCategorySelect();
                document.getElementById('new-category-input').value = '';
                // 追加したカテゴリを自動選択
                document.getElementById('category-select').value = name;
                document.getElementById('save-record-btn').disabled = false;
            }
        });

        document.getElementById('category-select').addEventListener('change', (e) => {
            document.getElementById('save-record-btn').disabled = !e.target.value;
        });

        document.getElementById('save-record-btn').addEventListener('click', async () => {
            const category = document.getElementById('category-select').value;
            const minutes = parseInt(document.getElementById('recorded-time').textContent);
            const text = document.getElementById('post-text').value.trim();
            const isPublic = document.getElementById('post-public').checked;
            
            if (category && minutes > 0) {
                await this.dataManager.addRecord(category, minutes, text, isPublic);
                this.hideCategoryModal();
                await this.updateUI();
                
                // 投稿した場合はコミュニティ画面に移動
                if (isPublic && text) {
                    this.switchView('community');
                }
                await this.updateUI();   // これが週合計・グラフの更新まで走る前提
            }
        });

        // ナビゲーション
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });

        // 目標設定
        document.getElementById('back-to-dashboard').addEventListener('click', () => {
            this.switchView('dashboard');
        });

        document.getElementById('save-goals-btn').addEventListener('click', () => {
            this.saveGoals();
            this.switchView('dashboard');
        });

        // コミュニティタブ
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateCommunity(btn.dataset.tab);
            });
        });

        // コメントモーダル
        document.getElementById('close-comment-modal').addEventListener('click', () => {
            this.hideCommentModal();
        });

        document.getElementById('post-comment-btn').addEventListener('click', () => {
            this.postComment();
        });
    }

    async switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(`${viewName}-view`).classList.add('active');
        const navBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (navBtn) navBtn.classList.add('active');
        
        if (viewName === 'dashboard') {
            await this.updateDashboard();
        } else if (viewName === 'community') {
            await this.updateCommunity('recommended');
        }
    }

    showCategoryModal(minutes) {
        document.getElementById('recorded-time').textContent = `${minutes}分`;
        this.updateCategorySelect();
        document.getElementById('category-select').value = '';
        document.getElementById('post-text').value = '';
        document.getElementById('post-public').checked = true;
        document.getElementById('save-record-btn').disabled = true;
        document.getElementById('category-modal').classList.remove('hidden');
    }

    hideCategoryModal() {
        document.getElementById('category-modal').classList.add('hidden');
    }

    async updateCategorySelect() {
        const select = document.getElementById('category-select');
        select.innerHTML = '<option value="">選択してください</option>';
        const categories = await this.dataManager.getCategories();
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }

    async updateUI() {
    await this.updateTodayRecords();
    await this.updateDashboard();
    }

    async updateTodayRecords() {
    const records = await this.dataManager.getTodayRecords();
    const list = document.getElementById('today-list');
    list.innerHTML = '';

    const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedRecords.forEach(r => {
        const time = new Date(r.created_at);
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
        const item = document.createElement('div');
        item.className = 'record-item';
        item.innerHTML = `
        <span><strong>${r.category}</strong> <span class="record-time">${timeStr}</span></span>
        <span>${r.minutes}分</span>
        `;
        list.appendChild(item);
    });

    const total = records.reduce((sum, r) => sum + r.minutes, 0);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    document.getElementById('today-total').textContent = `合計: ${hours}時間${minutes}分`;
    }

    async updateDashboard() {
    // goals をロードして保持（ここを追加）
    this.dataManager.goals = await this.dataManager.getGoals();

    const weekRecords = await this.dataManager.getWeekRecords();

    const totalMinutes = weekRecords.reduce((sum, r) => sum + r.minutes, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    document.getElementById('week-total').textContent = `${hours}時間${minutes}分`;

    const streak = await this.dataManager.getStreak(); // await にする
    document.getElementById('streak-days').textContent = `連続${streak}日間`;

    this.updateProgressBars(weekRecords);
    this.updateChart(weekRecords);
    }

    updateProgressBars(weekRecords) {
        const categoryTotals = {};
        weekRecords.forEach(r => {
            categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.minutes;
        });
        
        const list = document.getElementById('progress-list');
        list.innerHTML = '';
        
        Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, mins]) => {
            const hours = mins / 60;
            const goalHours = this.dataManager.goals[cat] || 0;
            const percentage = goalHours > 0 ? Math.min(Math.round((hours / goalHours) * 100), 100) : 0;
            
            let fillClass = 'low';
            if (percentage >= 100) fillClass = 'high';
            else if (percentage >= 50) fillClass = 'medium';
            
            const item = document.createElement('div');
            item.className = 'progress-item';
            item.innerHTML = `
                <div class="progress-header">
                    <span class="category-name">${cat}</span>
                    <span class="progress-stats">${hours.toFixed(1)}時間/${goalHours}時間 ${percentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${fillClass}" style="width: ${percentage}%"></div>
                </div>
            `;
            list.appendChild(item);
        });
        
        if (Object.keys(categoryTotals).length === 0) {
            list.innerHTML = '<p style="color: #999; text-align: center;">記録がありません</p>';
        }
    }

    updateChart(weekRecords) {
        if (typeof Chart === 'undefined') return;
        if (!Array.isArray(weekRecords)) return;

        const days = ['月', '火', '水', '木', '金', '土', '日'];
        const data = Array(7).fill(0);

        weekRecords.forEach(r => {
            const recordDate = new Date(r.created_at); // r.date → r.created_at に変更（ここが本命）
            if (isNaN(recordDate.getTime())) return;   // 念のため

            const dayIndex = (recordDate.getDay() + 6) % 7; // 月曜始まり
            data[dayIndex] += (Number(r.minutes) || 0) / 60; // minutesも数値化
        });

        const canvas = document.getElementById('week-chart'); // idはHTMLと一致させる
        if (!canvas) {
            console.error('canvas #week-chart が見つからない');
            return;
        }
        const ctx = canvas.getContext('2d'); // 安定させる

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
            labels: days,
            datasets: [{
                label: '時間',
                data,
                backgroundColor: '#333'
            }]
            },
            options: {
            responsive: true,
            maintainAspectRatio: false, // 高さが確保されてる前提。trueだと潰れることがある
            scales: {
                y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => value + 'h'
                }
                }
            },
            plugins: {
                legend: { display: false }
            }
            }
        });
    }   

    showGoalSettings() {
        const form = document.getElementById('goal-form');
        form.innerHTML = '';
        
        this.dataManager.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'goal-item';
            const currentGoal = this.dataManager.goals[cat] || 0;
            item.innerHTML = `
                <span>${cat}</span>
                <div>
                    <input type="number" min="0" max="168" value="${currentGoal}" data-category="${cat}">
                    <span> 時間/週</span>
                </div>
            `;
            form.appendChild(item);
        });
        
        if (this.dataManager.categories.length === 0) {
            form.innerHTML = '<p style="color: #999; text-align: center;">カテゴリがありません</p>';
        }
        
        document.getElementById('goal-settings-view').classList.add('active');
        document.getElementById('dashboard-view').classList.remove('active');
    }

    async saveGoals() {
        const inputs = document.querySelectorAll('#goal-form input');
        for (const input of inputs) {
            const category = input.dataset.category;
            const hours = parseInt(input.value) || 0;
            await this.dataManager.setGoal(category, hours);
        }
        await this.updateDashboard();
    }

    // コミュニティ機能
    async updateCommunity(filter = 'recommended') {
        const posts = await this.dataManager.getPosts(filter);
        const container = document.getElementById('posts-container');
        
        if (!container) {
            console.error('posts-container not found');
            return;
        }
        
        container.innerHTML = '';
        
        console.log('Posts count:', posts.length);

        posts.forEach(post => {
            const card = this.createPostCard(post);
            container.appendChild(card);
        });

        if (posts.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">投稿がありません</p>';
        }
    }

    createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'post-card';

        const timeAgo = this.getTimeAgo(post.timestamp);

        card.innerHTML = `
            <div class="post-header">
                <div class="post-user">
                    <div class="user-avatar"></div>
                    <div class="user-info">
                        <div class="user-name">${post.userName}</div>
                        <div class="post-time">${timeAgo}</div>
                    </div>
                </div>
                <div class="post-streak">${post.streak}日連続</div>
            </div>
            <div class="post-content">
                <div class="post-category">${post.category}</div>
                <div class="post-duration">${post.minutes}分</div>
                <div class="post-text">${post.text}</div>
            </div>
            <div class="post-actions">
                <button class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                    <span class="action-icon">${post.isLiked ? '♥' : '♡'}</span>
                    <span>${post.likes}</span>
                </button>
                <button class="action-btn comment-btn" data-post-id="${post.id}">
                    <span class="action-text">コメント</span>
                    <span>${post.commentsCount}</span>
                </button>
            </div>
        `;

        // いいねボタン
        const likeBtn = card.querySelector('.like-btn');
        likeBtn.addEventListener('click', async () => {
            await this.dataManager.toggleLike(post.id);
            await this.updateCommunity(document.querySelector('.tab-btn.active').dataset.tab);
        });

        // コメントボタン
        const commentBtn = card.querySelector('.comment-btn');
        commentBtn.addEventListener('click', () => {
            this.showCommentModal(post.id);
        });

        return card;
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'たった今';
        if (minutes < 60) return `${minutes}分前`;
        if (hours < 24) return `${hours}時間前`;
        return `${days}日前`;
    }

    async showCommentModal(postId) {
        this.currentPostId = postId;
        const comments = await this.dataManager.getComments(postId);
        
        const list = document.getElementById('comment-list');
        list.innerHTML = '';

        comments.forEach(comment => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            item.innerHTML = `
                <div class="comment-user">${comment.userName}</div>
                <div class="comment-text">${comment.text}</div>
            `;
            list.appendChild(item);
        });

        if (comments.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">コメントがありません</p>';
        }

        document.getElementById('comment-text').value = '';
        document.getElementById('comment-modal').classList.remove('hidden');
    }

    hideCommentModal() {
        document.getElementById('comment-modal').classList.add('hidden');
        this.currentPostId = null;
    }

    async postComment() {
        const text = document.getElementById('comment-text').value.trim();
        if (text && this.currentPostId) {
            await this.dataManager.addComment(this.currentPostId, text);
            await this.showCommentModal(this.currentPostId);
            await this.updateCommunity(document.querySelector('.tab-btn.active').dataset.tab);
        }
    }
}

// app.js 起動時（new App() より前でもOK）
(async () => {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code'); // ここが重要

    // code が無い通常アクセスでは何もしない
    if (!code) return;

    // code がある（メール確認リンクから戻ってきた）時だけセッション交換
    const { data, error } = await window.supabaseClient.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('exchangeCodeForSession error:', error);
      return;
    }

    // URLのcodeを消す（再実行防止）
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (e) {
    console.warn(e);
  }
})();

let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new App();
    });
} else {
    app = new App();
}
