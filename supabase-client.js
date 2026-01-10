// supabase-client.js
// Supabase SDK (CDN) と config.js を読み込んだ後に実行される前提

if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
  throw new Error('SUPABASE_CONFIG が未定義/不足です。config.js の url と anonKey を確認してください。');
}
if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  throw new Error('Supabase SDK が読み込めていません。index.html の script 順番を確認してください。');
}

// 「supabase」は SDK が使う名前と衝突しやすいので、クライアントは別名にする
const supabaseClient = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

// 認証ヘルパー関数
const SupabaseAuth = {
  // ユーザー登録
  async signUp(email, password, nickname, username) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { nickname, username } }
      });
      if (error) throw error;

      // confirm email ON のとき、data.session は基本 null
      return { success: true, needsEmailConfirm: !data.session };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ログイン
  async signIn(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  },

  // ログアウト
  async signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return true;
  },

  // 現在のユーザーを取得
  async getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) return null;
    return user;
  },

  // セッション変更を監視
  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};

// データベース操作ヘルパー関数
const SupabaseDB = {
  // プロフィール取得
  async getProfile(userId) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // カテゴリ追加
  async addCategory(name) {
    const user = await SupabaseAuth.getCurrentUser();
    const { data, error } = await supabaseClient
      .from('categories')
      .insert([{ user_id: user.id, name }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // カテゴリ一覧取得
  async getCategories() {
    const user = await SupabaseAuth.getCurrentUser();
    const { data, error } = await supabaseClient
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data;
  },

  // 記録追加
  async addRecord(category, minutes, text = '', isPublic = true, recordedAtIso = null) {
    const user = await SupabaseAuth.getCurrentUser();

    const payload = {
      user_id: user.id,
      category,
      minutes,
      text,
      is_public: isPublic,
    };

    payload.recorded_at = recordedAtIso ?? new Date().toISOString();
    // 日付だけを0時にしたISOを渡すなら recorded_at に入れる
    if (recordedAtIso) payload.recorded_at = recordedAtIso;

    // created_at はDBの作成時刻に任せる（触らない）
    // if (recordedAtIso) payload.created_at = recordedAtIso; ← これは消す

    const { data: record, error: recordError } = await supabaseClient
      .from('records')
      .insert([payload])
      .select()
      .single();

    if (recordError) throw recordError;

    // 公開投稿の場合、postsテーブルにも追加
    if (isPublic) {
      const { error: postError } = await supabaseClient
        .from('posts')
        .insert([{
          user_id: user.id,
          record_id: record.id
        }]);

      if (postError) throw postError;
    }

    return record;
  },



  // 記録削除
  async deleteRecord(recordId) {
    const { error } = await supabaseClient
      .from('records')
      .delete()
      .eq('id', recordId);

    if (error) throw error;
    return true;
  },

  // 記録更新
  async updateRecord(recordId, category, minutes, text) {
    const { data, error } = await supabaseClient
      .from('records')
      .update({
        category,
        minutes,
        text,
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 自分の記録取得
  async getMyRecords(startDate = null, endDate = null) {
    const user = await SupabaseAuth.getCurrentUser();

    let query = supabaseClient
      .from('records')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });    

    if (startDate) query = query.gte('recorded_at', startDate);
    if (endDate) query = query.lte('recorded_at', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // 特定ユーザーの記録取得（公開のみ）
  async getUserRecords(userId) {
    let query = supabaseClient
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('recorded_at', { ascending: false, nullsFirst: false }) 
      .order('created_at', { ascending: false });  

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // 目標設定
  async setGoal(category, hours) {
    const user = await SupabaseAuth.getCurrentUser();
    const { data, error } = await supabaseClient
      .from('goals')
      .upsert([{
        user_id: user.id,
        category,
        hours,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 目標取得
  async getGoals() {
    const user = await SupabaseAuth.getCurrentUser();
    const { data, error } = await supabaseClient
      .from('goals')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data;
  },

  // 投稿一覧取得（タイムライン）
  async getPosts(filter = 'recommended') {
    const user = await SupabaseAuth.getCurrentUser();

    let query = supabaseClient
      .from('posts')
      .select(`
        id,
        created_at,
        user_id,
        record_id,
        records (
          id,
          category,
          minutes,
          text,
          recorded_at
        ),
        profiles (
          nickname,
          username
        )
      `)
      .order('recorded_at', { ascending: false, foreignTable: 'records', nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'following') {
      const { data: follows } = await supabaseClient
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = (follows || []).map(f => f.following_id);
      followingIds.push(user.id);
      query = query.in('user_id', followingIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const postsWithCounts = await Promise.all((data || []).map(async (post) => {
      const { count: likesCount } = await supabaseClient
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      const { count: commentsCount } = await supabaseClient
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      const { data: myLike, error: myLikeError } = await supabaseClient
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (myLikeError) throw myLikeError;

      return {
        ...post,
        likes: likesCount || 0,
        commentsCount: commentsCount || 0,
        isLiked: !!myLike,
        isMyPost: post.user_id === user.id
      };
    }));

    return postsWithCounts;
  },

  // いいね追加/削除
  async toggleLike(postId) {
    const user = await SupabaseAuth.getCurrentUser();

    const { data: existingLike, error: likeError } = await supabaseClient
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (likeError) throw likeError;

    if (existingLike) {
      const { error } = await supabaseClient
        .from('likes')
        .delete()
        .eq('id', existingLike.id);

      if (error) throw error;
      return { action: 'removed' };
    } else {
      const { error } = await supabaseClient
        .from('likes')
        .insert([{
          user_id: user.id,
          post_id: postId
        }]);

      if (error) throw error;
      return { action: 'added' };
    }
  },

  // コメント追加
  async addComment(postId, text) {
    const user = await SupabaseAuth.getCurrentUser();
    const { data, error } = await supabaseClient
      .from('comments')
      .insert([{
        user_id: user.id,
        post_id: postId,
        text
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // コメント取得
  async getComments(postId) {
    const { data, error } = await supabaseClient
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        profiles (
          nickname,
          username
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  // フォロー追加/削除
  async toggleFollow(targetUserId) {
    const user = await SupabaseAuth.getCurrentUser();

    const { data: existingFollow } = await supabaseClient
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (existingFollow) {
      const { error } = await supabaseClient
        .from('follows')
        .delete()
        .eq('id', existingFollow.id);

      if (error) throw error;
      return { action: 'unfollowed' };
    } else {
      const { error } = await supabaseClient
        .from('follows')
        .insert([{
          follower_id: user.id,
          following_id: targetUserId
        }]);

      if (error) throw error;
      return { action: 'followed' };
    }
  },

  // フォロー状態確認
  async isFollowing(targetUserId) {
    const user = await SupabaseAuth.getCurrentUser();

    const { data, error } = await supabaseClient
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  // フォローリスト取得
  async getFollowing() {
    const user = await SupabaseAuth.getCurrentUser();

    const { data, error } = await supabaseClient
      .from('follows')
      .select(`
        following_id,
        profiles!follows_following_id_fkey (
          id,
          nickname,
          username
        )
      `)
      .eq('follower_id', user.id);

    if (error) throw error;
    return data.map(f => f.profiles);
  },

  // 次のやること（NA）追加（同カテゴリは上書き）
  async addNextAction(category, title, scheduledAtIso = null) {
    const user = await SupabaseAuth.getCurrentUser();

    // 同じカテゴリの未完了NAがあれば上書き、なければ新規追加（全消し前提で重複は想定しない）
    const { data: existing, error: findError } = await supabaseClient
      .from('next_actions')
      .select('id')
      .eq('user_id', user.id)
      .eq('category', category)
      .eq('done', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (findError) throw findError;

    if (existing && existing.length > 0) {
      const { data: updated, error: updateError } = await supabaseClient
        .from('next_actions')
        .update({
          title,
          scheduled_at: scheduledAtIso,
          done: false
        })
        .eq('id', existing[0].id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated;
    }

    const { data, error } = await supabaseClient
      .from('next_actions')
      .insert([
        {
          user_id: user.id,
          category,
          title,
          scheduled_at: scheduledAtIso,
          done: false
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getNextActionByCategory(category) {
    const user = await SupabaseAuth.getCurrentUser();

    const { data, error } = await supabaseClient
      .from('next_actions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', category)
      .eq('done', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data; // ない場合は null
  },

  // 次のやること（NA）取得（未完了）
  async getMyNextActions(limit = 3) {
    const user = await SupabaseAuth.getCurrentUser();

    const { data, error } = await supabaseClient
      .from('next_actions')
      .select('*')
      .eq('user_id', user.id)
      .eq('done', false)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
};

// app.js から確実に参照できるように window に公開
window.supabaseClient = supabaseClient;
window.SupabaseAuth = SupabaseAuth;
window.SupabaseDB = SupabaseDB;
