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
            // ユーザーステータスをオンラインに設定
            await SupabaseDB.updateUserStatus('online');
        }
        return !!this.currentUser;
    }

    // ユーザー認証
    async registerUser(email, password, nickname, username) {
        const result = await SupabaseAuth.signUp(email, password, nickname, username);
        
        if (result.success) {
            // メール確認が必要な場合
            if (result.needsEmailConfirm) {
                return { 
                    success: true, 
                    needsEmailConfirm: true,
                    message: '登録完了しました。メールで確認リンクをクリックしてからログインしてください。' 
                };
            }
            
            // メール確認なしの場合はそのままログイン
            this.currentUser = result.user;
            
            // プロフィールが作成されるまで少し待つ
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            try {
                this.userProfile = await SupabaseDB.getProfile(result.user.id);
            } catch (error) {
                console.log('Profile not found, creating manually...');
                // プロフィールがない場合は手動で作成
                try {
                    this.userProfile = await SupabaseDB.createProfile(result.user.id, nickname, username);
                } catch (createError) {
                    console.error('Profile creation error:', createError);
                    // もう一度取得を試みる
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    this.userProfile = await SupabaseDB.getProfile(result.user.id);
                }
            }
        }
        
        return result;
    }

    async loginUser(email, password) {
        const result = await SupabaseAuth.signIn(email, password);
        
        if (result.success) {
            this.currentUser = result.user;
            this.userProfile = await SupabaseDB.getProfile(result.user.id);
            // ユーザーステータスをオンラインに設定
            await SupabaseDB.updateUserStatus('online');
        }
        
        return result;
    }

    async logoutUser() {
        // ログアウト前にステータスをオフラインに設定
        await SupabaseDB.updateUserStatus('offline');
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

    async deleteCategory(name) {
        try {
            await SupabaseDB.deleteCategory(name);
            return true;
        } catch (error) {
            console.error('Delete category error:', error);
            return false;
        }
    }

    async deleteGoal(category) {
        try {
            await SupabaseDB.deleteGoal(category);
            return true;
        } catch (error) {
            console.error('Delete goal error:', error);
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

    // 次のやること（NA）
    async addNextAction(category, title, scheduledAtIso = null) {
        try {
            await SupabaseDB.addNextAction(category, title, scheduledAtIso);
            return true;
        } catch (error) {
            console.error('Add next action error:', error);
            return false;
        }
    }

    async getNextActions(limit = 3) {
        try {
            return await SupabaseDB.getMyNextActions(limit);
        } catch (error) {
            console.error('Get next actions error:', error);
            return [];
        }
    }

    async getNextActionByCategory(category) {
        try {
            return await SupabaseDB.getNextActionByCategory(category);
        } catch (error) {
            console.error('Get next action by category error:', error);
            return null;
        }
    }

    // 記録管理
    async addRecord(category, minutes, text = '', isPublic = true, createdAtIso = null) {
        try {
            await SupabaseDB.addRecord(category, minutes, text, isPublic, createdAtIso);
            return true;
        } catch (error) {
            console.error('Add record error:', error);
            return false;
        }
    }
    async deleteRecord(recordId) {
    try {
        await SupabaseDB.deleteRecord(recordId);
        return true;
    } catch (error) {
        console.error('Delete record error:', error);
        return false;
    }
    }

    async updateRecord(recordId, category, minutes, text) {
        try {
            await SupabaseDB.updateRecord(recordId, category, minutes, text);
            return true;
        } catch (error) {
            console.error('Update record error:', error);
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

    async getWeekRecords(weekOffset = 0) {
        const { start, end } = this.getWeekRange(weekOffset);
        return await window.SupabaseDB.getMyRecords(start.toISOString(), end.toISOString());
    }

    getWeekRange(weekOffset = 0) {
        const now = new Date();

        // 月曜=0, 日曜=6
        const day = (now.getDay() + 6) % 7;

        const start = new Date(now);
        start.setDate(now.getDate() - day + weekOffset * 7);
        start.setHours(0, 0, 0, 0);

        // end は「次の月曜 0:00 - 1ms」（Supabase側が lte なので inclusive で使う）
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        end.setMilliseconds(end.getMilliseconds() - 1);

        return { start, end };
    }

    async getUserRecords(userId) {
        try {
            return await SupabaseDB.getUserRecords(userId);
        } catch (error) {
            console.error('Get user records error:', error);
            return [];
        }
    }

    async getStreak() {
        try {
            const records = await SupabaseDB.getMyRecords();
            
            if (records.length === 0) return 0;
            
            const dates = [...new Set(records.map(r => new Date(r.recorded_at).toDateString()))];
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
    async setGoal(category, weekdayMinutes, weekendMinutes, isActive) {
        try {
            await SupabaseDB.setGoal(category, weekdayMinutes, weekendMinutes, isActive);
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
                const weekdayMinutes = Number(g.weekday_hours ?? 0);
                const weekendMinutes = Number(g.weekend_hours ?? 0);
                const storedMinutes = Number(g.hours ?? 0);
                const totalMinutes = storedMinutes > 0 ? storedMinutes : weekdayMinutes * 5 + weekendMinutes * 2;
                goalsObj[g.category] = {
                    weekdayMinutes,
                    weekendMinutes,
                    totalMinutes,
                    isActive: g.is_active ?? true
                };
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

            return posts.map((post) => {
                const recordedAt = post?.records?.recorded_at ?? post?.created_at; // フォールバック

                return {
                    id: post.id,
                    userId: post.user_id,
                    userName: post.profiles.nickname,
                    username: post.profiles.username,
                    recordId: post.records.id,
                    category: post.records.category,
                    minutes: post.records.minutes,
                    text: post.records.text,
                    streak: 0,
                    likes: post.likes,
                    commentsCount: post.commentsCount,
                    timestamp: new Date(recordedAt).getTime(),
                    isLiked: post.isLiked,
                    isMyPost: post.isMyPost,
                    comments: []
                };
            });
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

    async isFollowing(userId) {
        try {
            return await SupabaseDB.isFollowing(userId);
        } catch (error) {
            console.error('Is following error:', error);
            return false;
        }
    }

    async getFollowing() {
        try {
            return await SupabaseDB.getFollowing();
        } catch (error) {
            console.error('Get following error:', error);
            return [];
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
        this.currentStopwatchRecordedAtIso = null;
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

// アプリケーション
class App {
    constructor() {
        this.dataManager = new DataManager();
        this.stopwatch = new Stopwatch();
        this.chart = null;
        this.currentPostId = null;
        this.currentEditRecordId = null;
        this.currentViewUserId = null;
        this.pendingViewAfterNa = null;
        this.pendingViewAfterNa = null;
        this.lastRecordCategory = null;
        this.currentGoalEditCategory = null;
        this.currentNaCategory = null;
        this.goalMenuHandlerBound = false;
        this.goalMenuBound = false;
        this.naMenuHandlerBound = false;
        
         this.weekOffset = 0;

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
        document.getElementById('email-confirmation-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }

    showEmailConfirmation(email) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('email-confirmation-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('confirmation-email').textContent = email;
    }

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('email-confirmation-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        this.updateUI();
        this.updateHomeCategorySelect();
    }

    toDatetimeLocalValue(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }

    toDateInputValue(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
    }


    setupEventListeners() {

        // メール確認画面からログイン画面へ戻る
        document.getElementById('back-to-login-btn').addEventListener('click', () => {
            this.showLogin();
        });

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
                if (result.needsEmailConfirm) {
                    // メール確認が必要な場合は確認画面へ遷移
                    this.showEmailConfirmation(email);
                } else {
                    // メール確認なしの場合はそのままアプリへ
                    this.showApp();
                }
            } else {
                errorElement.style.color = '#e74c3c';
                errorElement.textContent = result.error || '登録に失敗しました';
            }
        });

        // ストップウォッチ
        document.getElementById('start-btn').addEventListener('click', async () => {
        const memoEl = document.getElementById('stopwatch-memo');

        if (!this.stopwatch.isRunning) {
            this.stopwatch.start();
            document.getElementById('start-btn').textContent = '一時停止';
            document.getElementById('start-btn').classList.add('paused');
            document.getElementById('stop-btn').disabled = false;

            if (memoEl) memoEl.classList.remove('hidden');
            
            // ステータスを「計測中」に更新
            const selectedCategory = document.getElementById('home-category-select').value;
            await SupabaseDB.updateUserStatus('measuring', selectedCategory || null);
        } else {
            this.stopwatch.pause();
            document.getElementById('start-btn').textContent = '再開';
            
            // 一時停止時はステータスを「オンライン」に戻す
            await SupabaseDB.updateUserStatus('online');
        }
        });

        // Home：カテゴリ選択で「やること」を表示
        const homeCat = document.getElementById('home-category-select');
        const useTodoBtn = document.getElementById('home-use-todo-btn');

        if (homeCat) {
          homeCat.addEventListener('change', async (e) => {
            const category = e.target.value;
            await this.renderHomeTodo(category);
          });
        }

        if (useTodoBtn) {
          useTodoBtn.addEventListener('click', () => {
            this.applyHomeTodoToMemo();
          });
        }

        document.getElementById('stop-btn').addEventListener('click', async () => {
        const minutes = this.stopwatch.getMinutes();
        const memoEl = document.getElementById('stopwatch-memo');
        const memoText = memoEl ? memoEl.value.trim() : '';

        if (minutes > 0) {
            this.currentStopwatchRecordedAtIso = new Date().toISOString();
            this.showCategoryModal(minutes, memoText);
        }

        this.stopwatch.stop();
        this.stopwatch.display();
        document.getElementById('start-btn').textContent = '開始';
        document.getElementById('start-btn').classList.remove('paused');
        document.getElementById('stop-btn').disabled = true;

        if (memoEl) memoEl.classList.add('hidden');
        
        // ステータスを「オンライン」に戻す
        await SupabaseDB.updateUserStatus('online');
        });

        // 手動追加ボタン
        document.getElementById('manual-add-btn').addEventListener('click', () => {
            this.showManualAddModal();
        });

        document.getElementById('category-select').addEventListener('change', (e) => {
            document.getElementById('save-record-btn').disabled = !e.target.value;
        });

        document.getElementById('save-record-btn').addEventListener('click', async () => {
            const category = document.getElementById('category-select').value;
            const minutes = parseInt(document.getElementById('recorded-time').textContent);
            const text = document.getElementById('post-text').value.trim();
            const naTitle = document.getElementById('stop-na-title').value.trim();
            const naDateValue = document.getElementById('stop-na-datetime').value;
            const isPublic = document.getElementById('post-public').checked;

            if (category && minutes > 0) {
                const ok = await this.dataManager.addRecord(
                category,
                minutes,
                text,
                isPublic,
                this.currentStopwatchRecordedAtIso || new Date().toISOString()
                );

                if (!ok) return;

                if (naTitle) {
                    let scheduledAtIso = null;
                    if (naDateValue) {
                        const [y, m, d] = naDateValue.split('-').map(Number);
                        const localDate = new Date(y, m - 1, d, 0, 0, 0);
                        if (!isNaN(localDate.getTime())) scheduledAtIso = localDate.toISOString();
                    }
                    const naOk = await this.dataManager.addNextAction(category, naTitle, scheduledAtIso);
                    if (!naOk) {
                        alert('次のやることの保存に失敗しました。');
                    }
                }

                this.lastRecordCategory = category;

                this.hideCategoryModal();
                await this.updateUI();

                const memoEl = document.getElementById('stopwatch-memo');
                if (memoEl) memoEl.value = '';
                this.currentStopwatchRecordedAtIso = null;

                // 保存後に「次のやること」モーダルを開く
                // コミュニティへの遷移は NA 入力後（またはスキップ後）に行う
                this.pendingViewAfterNa = (isPublic && text) ? 'community' : null;
                if (this.pendingViewAfterNa) {
                    this.switchView(this.pendingViewAfterNa);
                    this.pendingViewAfterNa = null;
                }
            }
        });

        // NAモーダル
        const naTitleEl = document.getElementById('na-title');
        const naSaveBtn = document.getElementById('na-save-btn');

        const refreshNaSaveEnabled = () => {
            const title = naTitleEl.value.trim();
            naSaveBtn.disabled = !title;
        };

        naTitleEl.addEventListener('input', refreshNaSaveEnabled);

        document.getElementById('na-skip-btn').addEventListener('click', async () => {
            this.hideNextActionModal();
            this.pendingViewAfterNa = null;
        });

        document.getElementById('na-save-btn').addEventListener('click', async () => {
            const title = document.getElementById('na-title').value.trim();
            const dtValue = document.getElementById('na-datetime').value;

            if (!title) return;
            const category = this.currentNaCategory || this.lastRecordCategory;
            if (!category) {
                alert('カテゴリを選択してから保存してください。');
                return;
            }

            let scheduledAtIso = null;
            if (dtValue) {
                const [y, m, d] = dtValue.split('-').map(Number);
                const localDate = new Date(y, m - 1, d, 0, 0, 0);
                if (!isNaN(localDate.getTime())) scheduledAtIso = localDate.toISOString();
            }

            const ok = await this.dataManager.addNextAction(category, title, scheduledAtIso);
            if (!ok) return;

            this.hideNextActionModal();
            if (this.pendingViewAfterNa) {
                this.switchView(this.pendingViewAfterNa);
                this.pendingViewAfterNa = null;
            }
            await this.updateNextActions();
        });

        if (!this.naMenuHandlerBound) {
            const naList = document.getElementById('na-list');
            if (naList) {
                this.naMenuHandlerBound = true;
                naList.addEventListener('click', async (e) => {
                    const menuBtn = e.target.closest('.na-menu-btn');

                    if (menuBtn) {
                        const item = menuBtn.closest('.na-item');
                        const category = item?.dataset?.category;
                        if (!category) return;
                        const na = await this.dataManager.getNextActionByCategory(category);
                        this.showNextActionModalForCategory(category, na);
                    }
                });
            }
        }

        // 手動追加モーダル
        const manualPostTextEl = document.getElementById('manual-post-text');
        const manualNaTitleEl = document.getElementById('manual-na-title');
        const manualNaDateEl = document.getElementById('manual-na-datetime');
        const manualNaSaveBtn = document.getElementById('manual-na-save-btn');
        const manualNaSkipBtn = document.getElementById('manual-na-skip-btn');
        const manualHoursEl = document.getElementById('manual-hours');
        const manualMinutesEl = document.getElementById('manual-minutes');
        const manualCategoryEl = document.getElementById('manual-category-select');

        const getManualTotalMinutes = () => {
            const hours = parseInt(manualHoursEl?.value, 10) || 0;
            const minutes = parseInt(manualMinutesEl?.value, 10) || 0;
            return hours * 60 + minutes;
        };

        const isManualRecordValid = () => {
            const category = manualCategoryEl ? manualCategoryEl.value : '';
            const totalMinutes = getManualTotalMinutes();
            return Boolean(category) && totalMinutes > 0;
        };

        const refreshManualNaSaveEnabled = () => {
            const validRecord = isManualRecordValid();
            if (manualNaSaveBtn) manualNaSaveBtn.disabled = !validRecord;
        };

        if (manualNaTitleEl) {
            manualNaTitleEl.addEventListener('input', refreshManualNaSaveEnabled);
        }
        if (manualHoursEl) {
            manualHoursEl.addEventListener('change', refreshManualNaSaveEnabled);
        }
        if (manualMinutesEl) {
            manualMinutesEl.addEventListener('change', refreshManualNaSaveEnabled);
        }
        if (manualCategoryEl) {
            manualCategoryEl.addEventListener('change', refreshManualNaSaveEnabled);
        }
        if (manualCategoryEl) {
            manualCategoryEl.addEventListener('change', async () => {
                if (!manualPostTextEl) return;
                if (manualPostTextEl.value.trim()) return;
                const category = manualCategoryEl.value;
                if (!category) return;
                const na = await this.dataManager.getNextActionByCategory(category);
                if (na?.title) {
                    manualPostTextEl.value = String(na.title);
                    refreshManualNaSaveEnabled();
                }
            });
        }

        const saveManualRecord = async () => {
            if (!isManualRecordValid()) {
                alert('カテゴリと時間を設定してください。');
                return null;
            }
            const totalMinutes = getManualTotalMinutes();
            const category = manualCategoryEl ? manualCategoryEl.value : '';
            const text = manualPostTextEl ? manualPostTextEl.value.trim() : '';
            const isPublic = document.getElementById('manual-post-public').checked;

            const dt = document.getElementById('manual-date').value;
            let createdAtIso = null;
            if (dt) {
                const [y, m, d] = dt.split('-').map(Number);
                const localMidnight = new Date(y, m - 1, d, 0, 0, 0);
                createdAtIso = localMidnight.toISOString();
            }

            const ok = await this.dataManager.addRecord(category, totalMinutes, text, isPublic, createdAtIso);
            if (!ok) return null;

            this.lastRecordCategory = category;
            this.pendingViewAfterNa = (isPublic && text) ? 'community' : null;
            await this.updateUI();
            return { category };
        };

        if (manualNaSkipBtn) {
            manualNaSkipBtn.addEventListener('click', async () => {
                if (manualNaTitleEl) manualNaTitleEl.value = '';
                if (manualNaDateEl) manualNaDateEl.value = '';
                refreshManualNaSaveEnabled();

                this.hideManualAddModal();
                if (this.pendingViewAfterNa) {
                    this.switchView(this.pendingViewAfterNa);
                    this.pendingViewAfterNa = null;
                }
                this.pendingViewAfterNa = null;
            });
        }

        if (manualNaSaveBtn) {
            manualNaSaveBtn.addEventListener('click', async () => {
                const saved = await saveManualRecord();
                if (!saved) return;
                const title = manualNaTitleEl ? manualNaTitleEl.value.trim() : '';
                let scheduledAtIso = null;
                const dtValue = manualNaDateEl ? manualNaDateEl.value : '';
                if (dtValue) {
                    const [y, m, d] = dtValue.split('-').map(Number);
                    const localDate = new Date(y, m - 1, d, 0, 0, 0);
                    if (!isNaN(localDate.getTime())) scheduledAtIso = localDate.toISOString();
                }
                if (title) {
                    const ok = await this.dataManager.addNextAction(saved.category, title, scheduledAtIso);
                    if (!ok) return;
                }

                if (manualNaTitleEl) manualNaTitleEl.value = '';
                if (manualNaDateEl) manualNaDateEl.value = '';
                refreshManualNaSaveEnabled();

                this.hideManualAddModal();
                if (this.pendingViewAfterNa) {
                    this.switchView(this.pendingViewAfterNa);
                    this.pendingViewAfterNa = null;
                }
            });
        }

        // 編集モーダル
        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
            this.hideEditModal();
        });

        document.getElementById('edit-save-btn').addEventListener('click', async () => {
            const hours = parseInt(document.getElementById('edit-hours').value) || 0;
            const minutes = parseInt(document.getElementById('edit-minutes').value) || 0;
            const totalMinutes = hours * 60 + minutes;
            const category = document.getElementById('edit-category-select').value;
            const text = document.getElementById('edit-post-text').value.trim();

            if (category && totalMinutes > 0 && this.currentEditRecordId) {
                await this.dataManager.updateRecord(this.currentEditRecordId, category, totalMinutes, text);
                this.hideEditModal();
                
                // 現在のビューを再読み込み
                if (this.currentViewUserId) {
                    await this.showUserPage(this.currentViewUserId);
                } else {
                    await this.updateUI();
                    await this.refreshCommunityIfActive();
                }
            }
        });

        // ナビゲーション
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view === 'user') {
                    // マイページの場合は自分のIDを渡す
                    this.showUserPage(this.dataManager.currentUser.id);
                } else {
                    this.switchView(view);
                }
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

        const goalEditModal = document.getElementById('goal-edit-modal');
        const goalEditTitle = document.getElementById('goal-edit-title');
        const goalEditCategory = document.getElementById('goal-edit-category');
        const goalEditWeekdayHours = document.getElementById('goal-edit-weekday-hours');
        const goalEditWeekdayMinutes = document.getElementById('goal-edit-weekday-minutes');
        const goalEditWeekendHours = document.getElementById('goal-edit-weekend-hours');
        const goalEditWeekendMinutes = document.getElementById('goal-edit-weekend-minutes');
        const goalEditApplyFlag = document.getElementById('goal-edit-apply-flag');
        const goalEditSaveBtn = document.getElementById('goal-edit-save-btn');
        const goalEditCancelBtn = document.getElementById('goal-edit-cancel-btn');
        const goalAddBtn = document.getElementById('goal-add-btn');

        const setupGoalTimeSelects = (hoursEl, minutesEl) => {
            if (!hoursEl || !minutesEl) return;
            hoursEl.innerHTML = '';
            for (let h = 0; h <= 23; h++) {
                const opt = document.createElement('option');
                opt.value = String(h);
                opt.textContent = String(h);
                hoursEl.appendChild(opt);
            }
            minutesEl.innerHTML = '';
            [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].forEach((m) => {
                const opt = document.createElement('option');
                opt.value = String(m);
                opt.textContent = String(m).padStart(2, '0');
                minutesEl.appendChild(opt);
            });
            hoursEl.value = '0';
            minutesEl.value = '0';
        };

        setupGoalTimeSelects(goalEditWeekdayHours, goalEditWeekdayMinutes);
        setupGoalTimeSelects(goalEditWeekendHours, goalEditWeekendMinutes);

        const getGoalMinutesValue = (hoursEl, minutesEl) => {
            const hours = Number(hoursEl?.value ?? 0);
            const minutes = Number(minutesEl?.value ?? 0);
            const safeHours = Number.isFinite(hours) ? hours : 0;
            const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
            return safeHours * 60 + safeMinutes;
        };

        const setGoalTimeValue = (hoursEl, minutesEl, value) => {
            if (!hoursEl || !minutesEl) return;
            const total = Math.max(0, Math.round(Number(value) || 0));
            const hours = Math.floor(total / 60);
            const minutes = total % 60;
            const snapped = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].includes(minutes) ? minutes : 0;
            hoursEl.value = String(Math.min(Math.max(hours, 0), 23));
            minutesEl.value = String(snapped);
        };

        const refreshGoalEditState = () => {
            if (!goalEditSaveBtn) return;
            const category = goalEditCategory ? goalEditCategory.value.trim() : '';
            const weekdayMinutes = getGoalMinutesValue(goalEditWeekdayHours, goalEditWeekdayMinutes);
            const weekendMinutes = getGoalMinutesValue(goalEditWeekendHours, goalEditWeekendMinutes);
            const isValid = Boolean(category) && Number.isFinite(weekdayMinutes) && Number.isFinite(weekendMinutes);
            goalEditSaveBtn.disabled = !isValid;
        };

        const openGoalEditForm = (data) => {
            if (!goalEditModal) return;
            const isNew = data?.isNew === true;
            this.currentGoalEditCategory = isNew ? null : data?.category || null;
            if (goalEditTitle) goalEditTitle.textContent = isNew ? '目標を登録' : '目標を編集';
            if (goalEditCategory) {
                goalEditCategory.value = data?.category || '';
                goalEditCategory.disabled = !isNew;
            }
            setGoalTimeValue(goalEditWeekdayHours, goalEditWeekdayMinutes, data?.weekdayMinutes ?? 0);
            setGoalTimeValue(goalEditWeekendHours, goalEditWeekendMinutes, data?.weekendMinutes ?? 0);
            if (goalEditApplyFlag) goalEditApplyFlag.checked = data?.isActive !== false;
            goalEditModal.classList.remove('hidden');
            refreshGoalEditState();
        };

        this.openGoalEditForm = openGoalEditForm;

        if (goalEditCategory) {
            goalEditCategory.addEventListener('input', refreshGoalEditState);
        }
        if (goalEditWeekdayHours) {
            goalEditWeekdayHours.addEventListener('change', refreshGoalEditState);
        }
        if (goalEditWeekdayMinutes) {
            goalEditWeekdayMinutes.addEventListener('change', refreshGoalEditState);
        }
        if (goalEditWeekendHours) {
            goalEditWeekendHours.addEventListener('change', refreshGoalEditState);
        }
        if (goalEditWeekendMinutes) {
            goalEditWeekendMinutes.addEventListener('change', refreshGoalEditState);
        }
        if (goalEditApplyFlag) {
            goalEditApplyFlag.addEventListener('change', refreshGoalEditState);
        }
        if (goalEditCancelBtn) {
            goalEditCancelBtn.addEventListener('click', () => {
                if (goalEditModal) goalEditModal.classList.add('hidden');
            });
        }
        if (goalEditSaveBtn) {
            goalEditSaveBtn.addEventListener('click', async () => {
                const categoryInput = goalEditCategory ? goalEditCategory.value.trim() : '';
                const weekdayMinutes = getGoalMinutesValue(goalEditWeekdayHours, goalEditWeekdayMinutes);
                const weekendMinutes = getGoalMinutesValue(goalEditWeekendHours, goalEditWeekendMinutes);
                const isActive = goalEditApplyFlag ? goalEditApplyFlag.checked : true;
                if (!categoryInput) return;

                const isNew = !this.currentGoalEditCategory;
                const targetCategory = isNew ? categoryInput : this.currentGoalEditCategory;

                if (isNew && this.dataManager.goals?.[targetCategory]) {
                    const ok = window.confirm('このカテゴリの目標は既に登録されています。上書きしますか？');
                    if (!ok) return;
                }

                const categories = this.dataManager.categories || await this.dataManager.getCategories();
                if (isNew && categories.includes(targetCategory)) {
                    const ok = window.confirm('このカテゴリは既にあります。目標を上書きしますか？');
                    if (!ok) return;
                }

                if (isNew) {
                    await this.dataManager.addCategory(targetCategory);
                    await this.updateCategorySelect();
                    await this.updateHomeCategorySelect();
                    await this.updateManualCategorySelect();
                    await this.updateEditCategorySelect();
                }

                await this.dataManager.setGoal(targetCategory, weekdayMinutes, weekendMinutes, isActive);
                await this.updateDashboard();

                if (goalEditModal) goalEditModal.classList.add('hidden');
                if (goalEditCategory) goalEditCategory.value = '';
                setGoalTimeValue(goalEditWeekdayHours, goalEditWeekdayMinutes, 0);
                setGoalTimeValue(goalEditWeekendHours, goalEditWeekendMinutes, 0);
                if (goalEditApplyFlag) goalEditApplyFlag.checked = true;
                refreshGoalEditState();
            });
        }
        if (goalAddBtn) {
            goalAddBtn.addEventListener('click', () => {
                openGoalEditForm({
                    category: '',
                    weekdayMinutes: 0,
                    weekendMinutes: 0,
                    isActive: true,
                    isNew: true
                });
            });
        }

        // コミュニティタブ
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateCommunity(btn.dataset.tab);
            });
        });

        // フォローリストモーダル
        document.getElementById('following-list-btn').addEventListener('click', () => {
            this.showFollowingModal();
        });

        document.getElementById('close-following-modal').addEventListener('click', () => {
            this.hideFollowingModal();
        });


        // フォローボタン
        document.getElementById('follow-btn').addEventListener('click', async () => {
            if (this.currentViewUserId) {
                await this.dataManager.toggleFollow(this.currentViewUserId);
                await this.showUserPage(this.currentViewUserId);
            }
        });
        
        const prevBtn = document.getElementById('week-prev-btn');
        if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
            this.weekOffset -= 1;
            await this.updateDashboard();
        });
        }

        const nextBtn = document.getElementById('week-next-btn');
        if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            this.weekOffset += 1;
            await this.updateDashboard();
        });
        }

        // どこにボタンを移動しても data-action="logout" があれば動く
        document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="logout"]');
        if (!btn) return;

        btn.disabled = true;
        try {
            await this.dataManager.logoutUser();

            // 次回ログイン時に変なビューが残らないように戻す（任意だけどおすすめ）
            await this.switchView('home');

            this.showLogin();
        } catch (err) {
            console.error('Logout failed:', err);
            alert('ログアウトに失敗しました');
        } finally {
            btn.disabled = false;
        }
        });

        if (!this.goalMenuHandlerBound) {
            const handleGoalMenuClick = async (e) => {
                const menuBtn = e.target.closest('.goal-menu-btn');
                if (menuBtn) {
                    e.stopPropagation();
                    const menu = menuBtn.parentElement?.querySelector('.goal-menu-dropdown');
                    if (menu) menu.classList.toggle('hidden');
                    return;
                }

                const menuItem = e.target.closest('.goal-menu-item');
                if (!menuItem) return;
                e.stopPropagation();
                const action = menuItem.dataset.action;
                const item = menuItem.closest('.goal-list-item');
                const category = item?.dataset.category;
                if (!category) return;
                const goal = this.dataManager.goals?.[category];
                const menu = menuItem.closest('.goal-menu-dropdown');

                if (action === 'edit') {
                    if (!goal || !this.openGoalEditForm) return;
                    this.openGoalEditForm({
                        category,
                        weekdayMinutes: goal.weekdayMinutes ?? 0,
                        weekendMinutes: goal.weekendMinutes ?? 0,
                        isActive: goal.isActive !== false,
                        isNew: false
                    });
                    if (menu) menu.classList.add('hidden');
                    return;
                }

                if (action === 'delete') {
                    const ok = window.confirm('このカテゴリを削除します。記録や投稿は削除されません。よろしいですか？');
                    if (!ok) return;
                    const goalDeleted = await this.dataManager.deleteGoal(category);
                    const categoryDeleted = await this.dataManager.deleteCategory(category);
                    if (!goalDeleted) {
                        alert('目標の削除に失敗しました。権限やRLSを確認してください。');
                        return;
                    }
                    if (!categoryDeleted) {
                        alert('カテゴリの削除に失敗しました。権限やRLSを確認してください。');
                        return;
                    }
                    if (this.dataManager.goals?.[category]) {
                        delete this.dataManager.goals[category];
                    }
                    if (Array.isArray(this.dataManager.categories)) {
                        this.dataManager.categories = this.dataManager.categories.filter(c => c !== category);
                    }
                    await this.updateDashboard();
                    if (menu) menu.classList.add('hidden');
                }
            };

            document.addEventListener('click', handleGoalMenuClick, true);
            this.goalMenuHandlerBound = true;
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.goal-menu')) return;
            document.querySelectorAll('.goal-menu-dropdown').forEach(menu => {
                menu.classList.add('hidden');
            });
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

    async showUserPage(userId) {
        this.currentViewUserId = userId;
        
        // ビューを切り替え
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('user-view').classList.add('active');
        const navBtn = document.querySelector('[data-view="user"]');
        if (navBtn) navBtn.classList.add('active');

        // プロフィール情報を取得
        const profile = await SupabaseDB.getProfile(userId);
        document.getElementById('user-profile-name').textContent = profile.nickname;
        document.getElementById('user-profile-username').textContent = `@${profile.username}`;

        // フォローボタンの表示制御
        const followBtn = document.getElementById('follow-btn');
        const followingListBtn = document.getElementById('following-list-btn');
        
        if (userId === this.dataManager.currentUser.id) {
            // 自分のページ
            followBtn.classList.add('hidden');
            followingListBtn.classList.remove('hidden');
        } else {
            // 他人のページ
            followBtn.classList.remove('hidden');
            followingListBtn.classList.add('hidden');
            
            const isFollowing = await this.dataManager.isFollowing(userId);
            followBtn.textContent = isFollowing ? 'フォロー中' : 'フォロー';
            followBtn.classList.toggle('following', isFollowing);
        }

        // 記録を取得して表示
        const records = await this.dataManager.getUserRecords(userId);
        const container = document.getElementById('user-records-container');
        container.innerHTML = '';

        if (records.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">記録がありません</p>';
            return;
        }

        records.forEach(record => {
            const card = this.createRecordCard(record, userId === this.dataManager.currentUser.id);
            container.appendChild(card);
        });
    }

    createRecordCard(record, isMyRecord) {
        const card = document.createElement('div');
        card.className = 'record-card';

        const time = new Date(record.created_at);
        const dateStr = `${time.getFullYear()}/${time.getMonth() + 1}/${time.getDate()}`;
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

        card.innerHTML = `
            <div class="record-header">
                <div class="record-date">${dateStr} ${timeStr}</div>
                ${isMyRecord ? `<button class="edit-record-btn" data-record-id="${record.id}">編集</button>` : ''}
            </div>
            <div class="record-content">
                <div class="record-category">${record.category}</div>
               <div class="record-duration">${this.formatDuration(record.minutes)}</div>
                ${record.text ? `<div class="record-text">${record.text}</div>` : ''}
            </div>
        `;

        // 編集ボタン
        if (isMyRecord) {
            const editBtn = card.querySelector('.edit-record-btn');
            editBtn.addEventListener('click', () => {
                this.showEditModal(record);
            });
        }

        return card;
    }

    async showCategoryModal(minutes, memoText = '') {
        document.getElementById('recorded-time').textContent = `${minutes}分`;
        await this.updateCategorySelect();
        const categorySelect = document.getElementById('category-select');
        const homeCategorySelect = document.getElementById('home-category-select');
        const preferredCategory = homeCategorySelect ? homeCategorySelect.value : '';
        if (categorySelect && preferredCategory && [...categorySelect.options].some(o => o.value === preferredCategory)) {
            categorySelect.value = preferredCategory;
        } else if (categorySelect) {
            categorySelect.value = '';
        }
        document.getElementById('post-text').value = memoText || '';
        document.getElementById('stop-na-title').value = '';
        document.getElementById('stop-na-datetime').value = '';
        document.getElementById('post-public').checked = true;
        document.getElementById('save-record-btn').disabled = !categorySelect?.value;
        document.getElementById('category-modal').classList.remove('hidden');
        }

    hideCategoryModal() {
        document.getElementById('category-modal').classList.add('hidden');
    }

    toDateValue(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } 

    async showManualAddModal() {
        document.getElementById('manual-hours').value = 0;
        document.getElementById('manual-minutes').value = 0;

        document.getElementById('manual-date').value = this.toDateValue(new Date());
        await this.updateManualCategorySelect();
        const manualCategorySelect = document.getElementById('manual-category-select');
        const homeCategorySelect = document.getElementById('home-category-select');
        const preferredCategory = homeCategorySelect ? homeCategorySelect.value : '';
        if (manualCategorySelect && preferredCategory && [...manualCategorySelect.options].some(o => o.value === preferredCategory)) {
            manualCategorySelect.value = preferredCategory;
        } else {
            manualCategorySelect.value = '';
        }
        document.getElementById('manual-post-public').checked = true;
        const manualNaDateEl = document.getElementById('manual-na-datetime');
        const manualNaSaveBtn = document.getElementById('manual-na-save-btn');
        const manualNaSkipBtn = document.getElementById('manual-na-skip-btn');
        const manualPostTextEl = document.getElementById('manual-post-text');
        const manualNaTitleEl = document.getElementById('manual-na-title');
        if (manualPostTextEl) manualPostTextEl.value = '';
        if (manualNaTitleEl) manualNaTitleEl.value = '';
        if (manualNaDateEl) manualNaDateEl.value = '';
        if (manualNaSaveBtn) manualNaSaveBtn.disabled = true;
        if (manualNaSkipBtn) manualNaSkipBtn.disabled = false;
        document.getElementById('manual-add-modal').classList.remove('hidden');
    }

    hideManualAddModal() {
        document.getElementById('manual-add-modal').classList.add('hidden');
    }

    async showEditModal(record) {
        this.currentEditRecordId = record.id;
        
        let hours = Math.floor(record.minutes / 60);
        const minutes = record.minutes % 60;

        // 分を5分単位に繰り上げ（0は0のまま）
        let roundedMinutes = Math.ceil(minutes / 5) * 5;

        // 60になったら繰り上げて 00 分にする
        if (roundedMinutes === 60) {
            hours += 1;
            roundedMinutes = 0;
        }

        // 表示上の上限（UIが 0-23 時なので安全側で丸め）
        if (hours > 23) {
            hours = 23;
            roundedMinutes = 55;
        }

        
        document.getElementById('edit-hours').value = hours;
        document.getElementById('edit-minutes').value = roundedMinutes >= 60 ? 55 : (roundedMinutes || 5);
        
        await this.updateEditCategorySelect();
        document.getElementById('edit-category-select').value = record.category;
        document.getElementById('edit-post-text').value = record.text || '';
        
        document.getElementById('edit-modal').classList.remove('hidden');
    }

    hideEditModal() {
        document.getElementById('edit-modal').classList.add('hidden');
        this.currentEditRecordId = null;
    }

    async showFollowingModal() {
        const following = await this.dataManager.getFollowing();
        const list = document.getElementById('following-list');
        list.innerHTML = '';

        if (following.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">フォロー中のユーザーはいません</p>';
        } else {
            following.forEach(user => {
                const item = document.createElement('div');
                item.className = 'following-item';
                item.innerHTML = `
                    <div class="following-user">
                        <div class="user-avatar-small"></div>
                        <div>
                            <div class="following-name">${user.nickname}</div>
                            <div class="following-username">@${user.username}</div>
                        </div>
                    </div>
                    <button class="unfollow-btn" data-user-id="${user.id}">フォロー解除</button>
                `;
                list.appendChild(item);

                // フォロー解除ボタン
                const unfollowBtn = item.querySelector('.unfollow-btn');
                unfollowBtn.addEventListener('click', async () => {
                    await this.dataManager.toggleFollow(user.id);
                    await this.showFollowingModal();
                });
            });
        }

        document.getElementById('following-modal').classList.remove('hidden');
    }

    hideFollowingModal() {
        document.getElementById('following-modal').classList.add('hidden');
    }

    async updateCategorySelect() {
        const select = document.getElementById('category-select');
        select.innerHTML = '<option value="">選択してください</option>';
        const categories = await this.dataManager.getCategories();
        this.sortCategoriesByGoalFlag(categories).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }

    async updateHomeCategorySelect() {
      const select = document.getElementById('home-category-select');
      if (!select) return;

      const current = select.value;
      select.innerHTML = '<option value="">カテゴリを選択</option>';

      const categories = await this.dataManager.getCategories();
      this.sortCategoriesByGoalFlag(categories).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });

      // 可能なら選択状態を維持
      if (current && categories.includes(current)) {
        select.value = current;
      }
    }

    async renderHomeTodo(category) {
      const box = document.getElementById('home-todo-box');
      const textEl = document.getElementById('home-todo-text');
      const btn = document.getElementById('home-use-todo-btn');
      if (!box || !textEl || !btn) return;

      if (!category) {
        box.classList.add('hidden');
        textEl.textContent = '';
        btn.disabled = true;
        btn.dataset.todo = '';
        return;
      }

      const na = await this.dataManager.getNextActionByCategory(category);

      box.classList.remove('hidden');

      const todo = na?.title ? String(na.title) : '';
      if (!todo) {
        textEl.textContent = '未設定';
        btn.disabled = true;
        btn.dataset.todo = '';
        return;
      }

      textEl.textContent = todo;
      btn.disabled = false;
      btn.dataset.todo = todo;
    }

    applyHomeTodoToMemo() {
      const btn = document.getElementById('home-use-todo-btn');
      const memoEl = document.getElementById('stopwatch-memo');
      if (!btn || !memoEl) return;

      const todo = (btn.dataset.todo || '').trim();
      if (!todo) return;

      const current = (memoEl.value || '').trim();
      if (current && current !== todo) {
        const ok = window.confirm('メモを上書きします。よろしいですか？');
        if (!ok) return;
      }

      memoEl.value = todo;

      memoEl.classList.remove('hidden');
    }

    async updateNaCategorySelect() {
        const select = document.getElementById('na-category-select');
        if (!select) return;
        select.innerHTML = '<option value="">選択してください</option>';
        const categories = await this.dataManager.getCategories();
        this.sortCategoriesByGoalFlag(categories).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }

    async updateManualCategorySelect() {
        const select = document.getElementById('manual-category-select');
        select.innerHTML = '<option value="">選択してください</option>';
        const categories = await this.dataManager.getCategories();
        this.sortCategoriesByGoalFlag(categories).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }

    async updateEditCategorySelect() {
        const select = document.getElementById('edit-category-select');
        select.innerHTML = '<option value="">選択してください</option>';
        const categories = await this.dataManager.getCategories();
        this.sortCategoriesByGoalFlag(categories).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }

    async updateUI() {
        await this.updateDashboard();
    }

    async refreshCommunityIfActive() {
        const view = document.getElementById('community-view');
        if (!view || !view.classList.contains('active')) return;
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'recommended';
        await this.updateCommunity(activeTab);
    }

    async updateDashboard() {
        this.dataManager.categories = await this.dataManager.getCategories();
        // goals をロードして保持
        this.dataManager.goals = await this.dataManager.getGoals();
        this.updateGoalRegistrationUI();
        await this.updateNextActions();

        const weekRecords = await this.dataManager.getWeekRecords(this.weekOffset);
        const { start } = this.dataManager.getWeekRange(this.weekOffset);

        const totalMinutes = weekRecords.reduce((sum, r) => sum + r.minutes, 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        document.getElementById('week-total').textContent = `${hours}時間${minutes}分`;

        const goalTotalMinutes = Object.values(this.dataManager.goals || {})
            .filter(goal => goal?.isActive !== false)
            .reduce((sum, goal) => sum + (Number(goal.totalMinutes) || 0), 0);
        const goalTextEl = document.getElementById('week-goal-progress');
        if (goalTextEl) {
            if (goalTotalMinutes > 0) {
                const rate = Math.min(Math.round((totalMinutes / goalTotalMinutes) * 100), 999);
                goalTextEl.textContent = `達成率 ${rate}% ・ 目標 ${this.formatDuration(goalTotalMinutes)}`;
            } else {
                goalTextEl.textContent = '目標未設定';
            }
        }

        const streak = await this.dataManager.getStreak();
        document.getElementById('streak-days').textContent = `連続${streak}日間`;

        this.updateProgressBars(weekRecords);
        this.updateChart(weekRecords, start);
    }

    async updateNextActions() {
        const list = document.getElementById('na-list');
        if (!list) return;

        list.innerHTML = '';

        const categories = Object.entries(this.dataManager.goals || {})
            .filter(([, goal]) => goal?.isActive !== false)
            .map(([cat]) => cat);

        if (categories.length === 0) {
            const p = document.createElement('p');
            p.className = 'na-empty';
            p.textContent = 'カテゴリがありません';
            list.appendChild(p);
            return;
        }

        const actions = await Promise.all(
            categories.map(async (category) => {
                const na = await this.dataManager.getNextActionByCategory(category);
                return { category, na };
            })
        );

        actions.forEach(({ category, na }) => {
            const item = document.createElement('div');
            item.className = 'na-item';
            item.dataset.category = category;
            const title = na?.title ? this.escapeHtml(na.title) : '未設定';
            const dateText = na?.scheduled_at ? this.formatNaDateTime(na.scheduled_at) : '';
            item.innerHTML = `
                <div class="na-meta">
                    <span class="na-category">${this.escapeHtml(category)}</span>
                    <button class="na-menu-btn" type="button" aria-label="NAメニュー">⋯</button>
                </div>
                <div class="na-title-row">
                    ${dateText ? `<span class="na-date">${this.escapeHtml(dateText)}</span>` : ''}
                    <span class="na-title-text">${title}</span>
                </div>
            `;
            list.appendChild(item);
        });
    }

    formatNaDateTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const m = d.getMonth() + 1;
        const day = d.getDate();
        return `${m}/${day}`;
    }

    escapeHtml(str) {
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    showNextActionModal() {
        const modal = document.getElementById('na-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this.currentNaCategory = null;
        const titleEl = document.getElementById('na-title');
        const dtEl = document.getElementById('na-datetime');
        const saveBtn = document.getElementById('na-save-btn');
        if (titleEl) titleEl.value = '';
        if (dtEl) dtEl.value = '';
        if (saveBtn) saveBtn.disabled = true;
    }

    showNextActionModalForCategory(category, na) {
        const modal = document.getElementById('na-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this.currentNaCategory = category;
        const titleEl = document.getElementById('na-title');
        const dtEl = document.getElementById('na-datetime');
        const saveBtn = document.getElementById('na-save-btn');
        if (titleEl) titleEl.value = na?.title ? String(na.title) : '';
        if (dtEl) {
            if (na?.scheduled_at) {
                const d = new Date(na.scheduled_at);
                dtEl.value = isNaN(d.getTime()) ? '' : this.toDateInputValue(d);
            } else {
                dtEl.value = '';
            }
        }
        if (saveBtn) saveBtn.disabled = !(titleEl?.value || '').trim();
    }

    hideNextActionModal() {
        const modal = document.getElementById('na-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        this.currentNaCategory = null;
    }

    sortCategoriesByGoalFlag(categories = []) {
        const goals = this.dataManager.goals || {};
        return categories
            .map((cat, index) => {
                const isInactive = goals[cat]?.isActive === false;
                return { cat, index, isInactive };
            })
            .sort((a, b) => {
                if (a.isInactive === b.isInactive) return a.index - b.index;
                return a.isInactive ? 1 : -1;
            })
            .map(item => item.cat);
    }

    formatGoalMinutes(value) {
        const minutes = Math.max(0, Math.round(Number(value) || 0));
        return this.formatDuration(minutes);
    }

    updateGoalRegistrationUI() {
        const listActive = document.getElementById('goal-list-active');
        const listInactive = document.getElementById('goal-list-inactive');
        const sectionActive = document.getElementById('goal-subsection-active');
        const sectionInactive = document.getElementById('goal-subsection-inactive');
        if (!listActive || !listInactive) return;

        const entries = Object.entries(this.dataManager.goals || {});
        const activeEntries = entries.filter(([, goal]) => goal?.isActive !== false);
        const inactiveEntries = entries.filter(([, goal]) => goal?.isActive === false);

        listActive.innerHTML = '';
        listInactive.innerHTML = '';

        const renderList = (container, items, emptyText, section) => {
            if (items.length === 0) {
                container.innerHTML = `<p style="color: #999; text-align: center;">${emptyText}</p>`;
                if (section) section.classList.add('hidden');
                return;
            }
            if (section) section.classList.remove('hidden');

            items.forEach(([category, goal]) => {
                const item = document.createElement('div');
                item.className = 'goal-list-item';
                item.dataset.category = category;
                const weekday = this.formatGoalMinutes(goal.weekdayMinutes ?? 0);
                const weekend = this.formatGoalMinutes(goal.weekendMinutes ?? 0);
                const total = this.formatGoalMinutes(goal.totalMinutes ?? 0);
                item.innerHTML = `
                    <div class="goal-list-header">
                        <div class="goal-list-title">${this.escapeHtml(category)}</div>
                        <div class="goal-menu">
                            <button class="goal-menu-btn" aria-label="目標メニュー">⋯</button>
                            <div class="goal-menu-dropdown hidden">
                                <button class="goal-menu-item" data-action="edit">編集</button>
                                <button class="goal-menu-item danger" data-action="delete">削除</button>
                            </div>
                        </div>
                    </div>
                    <div class="goal-list-meta">
                        <span>平日 ${weekday}/日</span>
                        <span>土日 ${weekend}/日</span>
                        <span>週合計 ${total}</span>
                    </div>
                `;

                container.appendChild(item);
            });
        };

        renderList(listActive, activeEntries, '目標がありません', sectionActive);
        renderList(listInactive, inactiveEntries, '目標がありません', sectionInactive);

        listActive.onclick = null;
        listInactive.onclick = null;
    }

    updateProgressBars(weekRecords) {
        const categoryTotals = {};
        weekRecords.forEach(r => {
            categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.minutes;
        });
        
        const list = document.getElementById('progress-list');
        list.innerHTML = '';
        
        const goalEntries = Object.entries(this.dataManager.goals || {})
            .filter(([, goal]) => goal?.isActive !== false)
            .map(([cat]) => cat);

        const allCategories = Array.from(new Set([
            ...Object.keys(categoryTotals),
            ...goalEntries
        ]));

        const sorted = allCategories
            .map((cat) => {
                const goal = this.dataManager.goals?.[cat];
                const goalMinutes = Number(goal?.totalMinutes) || 0;
                return { cat, mins: categoryTotals[cat] || 0, goalMinutes, goal };
            })
            .sort((a, b) => b.goalMinutes - a.goalMinutes);

        sorted.forEach(({ cat, mins, goalMinutes, goal }) => {
            if (goal && goal.isActive === false) return;

            const percentage = goalMinutes > 0 ? Math.min(Math.round((mins / goalMinutes) * 100), 100) : 0;

            let fillClass = 'low';
            if (percentage >= 100) fillClass = 'high';
            else if (percentage >= 50) fillClass = 'medium';

            const item = document.createElement('div');
            item.className = 'progress-item';
            item.innerHTML = `
                <div class="progress-header">
                    <span class="category-name">${cat}</span>
                    <span class="progress-stats">${this.formatDuration(mins)}/${this.formatDuration(goalMinutes)} ${percentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${fillClass}" style="width: ${percentage}%"></div>
                </div>
            `;
            list.appendChild(item);
        });

        if (sorted.length === 0) {
            list.innerHTML = '<p style="color: #999; text-align: center;">目標がありません</p>';
        }
    }

    updateChart(weekRecords, weekStartDate) {
        if (typeof Chart === 'undefined') return;
        if (!Array.isArray(weekRecords)) return;

        const start = new Date(weekStartDate);
        start.setHours(0, 0, 0, 0);

        const labels = Array.from({ length: 7 }, (_, i) => {
            const dt = new Date(start);
            dt.setDate(start.getDate() + i);
            return `${dt.getMonth() + 1}/${dt.getDate()}`;
        });

        const data = Array(7).fill(0);
        const goalData = Array(7).fill(0);
        const goalIsWeekend = Array(7).fill(false);

        weekRecords.forEach(r => {
        const recordDate = new Date(r.recorded_at ?? r.created_at);
        if (isNaN(recordDate.getTime())) return;

        // 日単位で index を出す（表示してる週の start 基準）
        const rd = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
        const sd = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const diff = Math.floor((rd - sd) / (1000 * 60 * 60 * 24));

        if (diff < 0 || diff > 6) return;
        data[diff] += (Number(r.minutes) || 0) / 60;
        });

        for (let i = 0; i < 7; i++) {
            const dt = new Date(start);
            dt.setDate(start.getDate() + i);
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            goalIsWeekend[i] = isWeekend;
            const goals = Object.values(this.dataManager.goals || {}).filter(g => g?.isActive !== false);
            const totalMinutes = goals.reduce((sum, g) => {
                const minutes = Number(isWeekend ? g.weekendMinutes : g.weekdayMinutes) || 0;
                return sum + minutes;
            }, 0);
            goalData[i] = totalMinutes / 60;
        }

        const maxValue = Math.max(0, ...data, ...goalData);
        const suggestedMax = maxValue > 0 ? Math.ceil(maxValue * 1.2 * 2) / 2 : 1;

        const canvas = document.getElementById('week-chart');
        if (!canvas) {
            console.error('canvas #week-chart が見つからない');
            return;
        }
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#2f2f2f');
        gradient.addColorStop(1, '#bdbdbd');

        if (this.chart) this.chart.destroy();

        const goalMarkerPlugin = {
            id: 'goalMarkers',
            afterDatasetsDraw: (chart) => {
                const yScale = chart.scales?.y;
                const meta = chart.getDatasetMeta(0);
                if (!yScale || !meta?.data) return;
                const ctx = chart.ctx;
                ctx.save();
                const weekdayColor = '#c0892b';
                const weekendColor = '#c0892b';
                ctx.lineWidth = 2;
                meta.data.forEach((bar, i) => {
                    const goalValue = goalData[i];
                    if (!goalValue || goalValue <= 0) return;
                    ctx.strokeStyle = goalIsWeekend[i] ? weekendColor : weekdayColor;
                    const y = yScale.getPixelForValue(goalValue);
                    const x = bar.x;
                    const half = bar.width ? bar.width / 2 : 12;
                    ctx.beginPath();
                    ctx.moveTo(x - half, y);
                    ctx.lineTo(x + half, y);
                    ctx.stroke();
                });
                ctx.restore();
            }
        };

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
            labels,
            datasets: [{
                label: '時間',
                data,
                backgroundColor: gradient,
                borderRadius: 8,
                borderSkipped: false,
                order: 1
            }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax,
                        ticks: {
                            callback: (value) => value + 'h'
                        },
                        grid: {
                            color: '#eee'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(1)}h`
                        }
                    }
                },
                animation: {
                    duration: 300
                }
            }
        , plugins: [goalMarkerPlugin]});
    }

    showGoalSettings() {
        const form = document.getElementById('goal-form');
        form.innerHTML = '';
        
        this.dataManager.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'goal-item';
            const currentGoalMinutes = this.dataManager.goals[cat]?.totalMinutes || 0;
            const currentGoalHours = currentGoalMinutes / 60;
            item.innerHTML = `
                <span>${cat}</span>
                <div>
                    <input type="number" min="0" max="168" value="${currentGoalHours}" data-category="${cat}">
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
            const hours = parseFloat(input.value) || 0;
            const totalMinutes = Math.round(hours * 60);
            const isActive = this.dataManager.goals?.[category]?.isActive ?? true;
            await this.dataManager.setGoal(category, totalMinutes, null, isActive);
        }
        await this.updateDashboard();
    }

    // コミュニティ機能
    async updateCommunity(filter = 'recommended') {
        // アクティブユーザー数を更新
        await this.updateActiveUsersCount();
        
        const posts = await this.dataManager.getPosts(filter);
        const container = document.getElementById('posts-container');
        
        if (!container) {
            console.error('posts-container not found');
            return;
        }
        
        container.innerHTML = '';

        posts.forEach(post => {
            const card = this.createPostCard(post);
            container.appendChild(card);
        });

        if (posts.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">投稿がありません</p>';
        }
    }

    async updateActiveUsersCount() {
        try {
            const count = await SupabaseDB.getActiveFollowingCount();
            const activeUsersText = document.getElementById('active-users-text');
            if (activeUsersText) {
                activeUsersText.textContent = `フォロー中 ${count}人 がアクティブ`;
            }
        } catch (error) {
            console.error('Error updating active users count:', error);
        }
    }

    createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'post-card';

        const timeText = this.formatDateTime(post.timestamp);

        card.innerHTML = `
            <div class="post-header">
                <div class="post-user" data-user-id="${post.userId}">
                    <div class="user-avatar"></div>
                    <div class="user-info">
                        <div class="user-name">${post.userName}</div>
                        <div class="post-time">${timeText}</div>
                    </div>
                </div>
                ${post.isMyPost ? `
                    <div class="post-menu">
                        <button class="post-menu-btn" aria-label="投稿メニュー">⋯</button>
                        <div class="post-menu-dropdown hidden">
                            <button class="post-menu-item" data-action="edit">編集</button>
                            <button class="post-menu-item danger" data-action="delete">削除</button>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="post-content">
                <div class="post-meta-line">
                    <div class="post-category">${post.category}</div>
                    <div class="post-duration">${this.formatDuration(post.minutes)}</div>
                </div>
                <div class="post-text">${post.text}</div>
            </div>
            <div class="post-actions">
                <button class="action-btn like-btn ${post.isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                    <span class="action-icon">${post.isLiked ? '♥' : '♡'}</span>
                    <span>${post.likes}</span>
                </button>
            </div>
        `;

        // ユーザー名クリックでユーザーページへ
        const userElement = card.querySelector('.post-user');
        userElement.style.cursor = 'pointer';
        userElement.addEventListener('click', () => {
            this.showUserPage(post.userId);
        });

        // いいねボタン
        const likeBtn = card.querySelector('.like-btn');
        likeBtn.addEventListener('click', async () => {
            await this.dataManager.toggleLike(post.id);
            await this.updateCommunity(document.querySelector('.tab-btn.active').dataset.tab);
        });

        if (post.isMyPost) {
            const menuBtn = card.querySelector('.post-menu-btn');
            const menu = card.querySelector('.post-menu-dropdown');
            const menuItems = card.querySelectorAll('.post-menu-item');

            if (menuBtn && menu) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('hidden');
                });
            }

            menuItems.forEach(item => {
                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    if (action === 'edit') {
                        this.showEditModal({
                            id: post.recordId,
                            minutes: post.minutes,
                            category: post.category,
                            text: post.text || ''
                        });
                        menu.classList.add('hidden');
                        return;
                    }
                    if (action === 'delete') {
                        const ok = window.confirm('この投稿を削除します。よろしいですか？');
                        if (!ok) return;
                        await this.dataManager.deleteRecord(post.recordId);
                        menu.classList.add('hidden');
                        await this.updateUI();
                        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'recommended';
                        await this.updateCommunity(activeTab);
                    }
                });
            });

            document.addEventListener('click', (e) => {
                if (!menu || menu.classList.contains('hidden')) return;
                if (!card.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        }

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

    formatDuration(totalMinutes) {
        const m = Number(totalMinutes) || 0;
        if (m < 60) return `${m}分`;

        const h = Math.floor(m / 60);
        const r = m % 60;

        if (r === 0) return `${h}時間`;
        return `${h}時間${r}分`;
    }   
    formatDateTime(timestamp) {
        const d = new Date(timestamp);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');

        return `${yyyy}/${mm}/${dd}`;
    }   

    // コメント機能は無効化
}

// app.js 起動時
(async () => {
    try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (!code) return;

        const { data, error } = await window.supabaseClient.auth.exchangeCodeForSession(code);
        if (error) {
            console.warn('exchangeCodeForSession error:', error);
            return;
        }

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
