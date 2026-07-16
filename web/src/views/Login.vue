<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-card__brand">
        <img src="/logo.png" alt="logo" class="auth-card__logo" />
        <h1 class="auth-card__title">酒馆角色卡锻造器</h1>
        <p class="auth-card__subtitle">使用酒馆大模型官网账号登录</p>
      </div>

      <div class="auth-tabs">
        <button :class="{ active: mode === 'login' }" @click="switchMode('login')">登录</button>
        <button :class="{ active: mode === 'register' }" @click="switchMode('register')">注册</button>
      </div>

      <!-- 登录 -->
      <form v-if="mode === 'login'" @submit.prevent="doLogin">
        <div class="form-group">
          <label>用户名</label>
          <input class="input" v-model="loginForm.username" placeholder="官网账号用户名" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input class="input" type="password" v-model="loginForm.password" placeholder="密码" autocomplete="current-password" />
        </div>
        <button class="btn btn--accent auth-submit" type="submit" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>

      <!-- 注册 -->
      <form v-else @submit.prevent="doRegister">
        <div class="form-group">
          <label>用户名</label>
          <input class="input" v-model="regForm.username" placeholder="3-20 位字符" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input class="input" type="password" v-model="regForm.password" placeholder="至少 6 位" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label>邮箱（选填，用于验证）</label>
          <input class="input" type="email" v-model="regForm.email" placeholder="邮箱地址" autocomplete="email" />
        </div>
        <div class="form-group" v-if="regForm.email">
          <label>验证码</label>
          <div class="auth-code-row">
            <input class="input" v-model="regForm.verification_code" placeholder="验证码" />
            <button type="button" class="btn btn--sm" :disabled="codeCooldown > 0" @click="doSendCode">
              {{ codeCooldown > 0 ? codeCooldown + 's' : '发送验证码' }}
            </button>
          </div>
        </div>
        <button class="btn btn--accent auth-submit" type="submit" :disabled="loading">
          {{ loading ? '注册中…' : '注册并登录' }}
        </button>
      </form>

      <div class="auth-footer">
        没有账号？前往
        <a href="https://deepseektavern.com" target="_blank" rel="noopener">酒馆大模型官网</a>
        注册
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useAppStore } from '../stores/app.js';

const router = useRouter();
const auth = useAuthStore();
const appStore = useAppStore();

defineOptions({ name: 'Login' });

const mode = ref('login');
const loading = ref(false);
const codeCooldown = ref(0);

const loginForm = reactive({ username: '', password: '' });
const regForm = reactive({ username: '', password: '', email: '', verification_code: '' });

function switchMode(m) {
  mode.value = m;
}

async function doLogin() {
  if (!loginForm.username || !loginForm.password) {
    appStore.toastError('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    await auth.login(loginForm.username, loginForm.password);
    appStore.toastSuccess('登录成功');
    router.push('/');
  } catch (e) {
    appStore.toastError(e.message);
  } finally {
    loading.value = false;
  }
}

async function doRegister() {
  if (!regForm.username || !regForm.password) {
    appStore.toastError('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    await auth.register({
      username: regForm.username,
      password: regForm.password,
      email: regForm.email || undefined,
      verification_code: regForm.verification_code || undefined
    });
    appStore.toastSuccess('注册成功，已自动登录');
    router.push('/');
  } catch (e) {
    appStore.toastError(e.message);
  } finally {
    loading.value = false;
  }
}

async function doSendCode() {
  if (!regForm.email) {
    appStore.toastError('请先填写邮箱');
    return;
  }
  try {
    await auth.sendCode(regForm.email);
    appStore.toastSuccess('验证码已发送');
    codeCooldown.value = 60;
    const timer = setInterval(() => {
      codeCooldown.value--;
      if (codeCooldown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (e) {
    appStore.toastError(e.message);
  }
}
</script>
