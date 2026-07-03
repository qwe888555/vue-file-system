<template>
  <div class="landing">
    <!-- ═══ 导航栏 ═══ -->
    <header class="navbar" :class="{ 'navbar--scrolled': scrolled }">
      <div class="navbar-inner">
        <div class="navbar-brand" @click="scrollTo('hero')">
          <img :src="logoImg" alt="成都东软学院" class="navbar-logo" />
        </div>
        <nav class="navbar-nav">
          <button class="nav-link" @click="scrollTo('product')">功能介绍</button>
          <button class="nav-link" @click="scrollTo('school')">学校概况</button>
          <button class="nav-link" @click="scrollTo('gallery')">校园风采</button>
          <button class="nav-link" @click="goLogin">登 录</button>
        </nav>
      </div>
    </header>

    <!-- ═══ Hero 区 ═══ -->
    <section id="hero" class="hero">
      <div class="hero-bg" :style="{ backgroundImage: `url(${heroBg})` }" />
      <div class="hero-overlay" />
      <div class="hero-content">
        <h1 class="hero-title">NISU-CD 资源系统</h1>
        <p class="hero-sub">
          为成都东软学院 3 万+ 师生打造的<br />一站式 AI 知识库智能问答平台
        </p>
        <div class="hero-actions">
          <el-button class="hero-primary" size="large" round @click="goLogin">
            开始体验
          </el-button>
          <el-button size="large" round plain class="hero-more" @click="scrollTo('product')">
            了解更多
          </el-button>
        </div>
      </div>
    </section>

    <!-- ═══ 产品功能 ═══ -->
    <section id="product" class="section section--white">
      <div class="section-inner">
        <h2 class="section-title">产品功能</h2>
        <p class="section-desc">基于已上传的课程资料与知识文档，AI 精准回答学业问题</p>

        <!-- 核心功能：智能问答 -->
        <div class="feature-main reveal" style="transition-delay: 0ms">
          <div class="feature-main-content">
            <h3>智能问答</h3>
            <div class="feature-flow">
              <div class="feature-flow-step">
                <span class="step-num">01</span>
                <div class="step-text">
                  <strong>上传资料</strong>
                  <span>老师上传课件、论文、行政文档至知识库</span>
                </div>
              </div>
              <div class="feature-flow-step">
                <span class="step-num">02</span>
                <div class="step-text">
                  <strong>提出问题</strong>
                  <span>师生输入自然语言问题，无需关键词匹配</span>
                </div>
              </div>
              <div class="feature-flow-step">
                <span class="step-num">03</span>
                <div class="step-text">
                  <strong>检索匹配</strong>
                  <span>系统搜索知识库，定位最相关的文档内容</span>
                </div>
              </div>
              <div class="feature-flow-step">
                <span class="step-num">04</span>
                <div class="step-text">
                  <strong>生成回答</strong>
                  <span>综合多份资料生成精准、可追溯的答案</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 辅助功能卡片 -->
        <div class="feature-cards">
          <div class="feature-card reveal" style="transition-delay: 100ms">
            <h4>知识库管理</h4>
            <p>管理员统一上传、分类、管理各类教学资源文件</p>
          </div>
          <div class="feature-card reveal" style="transition-delay: 200ms">
            <h4>权限管理</h4>
            <p>超级管理员、学院管理员、普通用户三级角色，数据分级安全可控</p>
          </div>
        </div>

        <!-- 权限说明 -->
        <div class="perm-box">
          <div class="perm-item">
            <span class="perm-badge perm-badge--user">普通用户</span>
            <span>获得答案信息，不可下载源文件</span>
          </div>
          <div class="perm-item">
            <span class="perm-badge perm-badge--admin">高权限账号</span>
            <span>可查阅 / 下载源文件</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 学校概况 ═══ -->
    <section id="school" class="section section--blue">
      <div class="section-inner">
        <h2 class="section-title section-title--light">学校概况</h2>
        <p class="section-desc section-desc--light">成都东软学院（Chengdu Neusoft University）</p>

        <!-- 核心数据 -->
        <div id="school-stats" class="stats">
          <div class="stat-card reveal" style="transition-delay: 0ms">
            <span class="stat-number">{{ countUp.area }}<small>万㎡</small></span>
            <span class="stat-label">占地面积</span>
          </div>
          <div class="stat-card reveal" style="transition-delay: 100ms">
            <span class="stat-number">{{ countUp.units }}<small>个</small></span>
            <span class="stat-label">教学科研单位</span>
          </div>
          <div class="stat-card reveal" style="transition-delay: 200ms">
            <span class="stat-number">{{ countUp.students }}<small>万+</small></span>
            <span class="stat-label">在校生</span>
          </div>
        </div>

        <!-- 第二排数据 -->
        <div class="stats-sub">
          <div class="stats-sub-item reveal" style="transition-delay: 50ms">
            <span class="sub-number">{{ countUp.enterprises }}<span class="sub-unit">+</span></span>
            <span class="sub-label">合作企业</span>
          </div>
          <div class="stats-sub-item reveal" style="transition-delay: 150ms">
            <span class="sub-number">{{ countUp.countries }}<span class="sub-unit">+</span></span>
            <span class="sub-label">留学生国家</span>
          </div>
          <div class="stats-sub-item reveal" style="transition-delay: 250ms">
            <span class="sub-number">{{ countUp.bases }}</span>
            <span class="sub-label">省级实践基地</span>
          </div>
          <div class="stats-sub-item reveal" style="transition-delay: 350ms">
            <span class="sub-number">2014</span>
            <span class="sub-label">留学生办学起点</span>
          </div>
        </div>

        <!-- 详细介绍 -->
        <div class="school-detail">
          <div class="detail-col reveal" style="transition-delay: 0ms">
            <h4>办学定位</h4>
            <p>应用型本科高校，以本科教育为主，同步开展留学生、继续教育</p>
          </div>
          <div class="detail-col reveal" style="transition-delay: 100ms">
            <h4>办学理念</h4>
            <p>教育创造学生价值，全校推行 TOPCARES 一体化培养模式</p>
          </div>
          <div class="detail-col reveal" style="transition-delay: 200ms">
            <h4>育人机制</h4>
            <p>独创「八协同」产教融合机制，校企深度合作培养应用型人才</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 校园风采 ═══ -->
    <section id="gallery" class="section section--white">
      <div class="section-inner">
        <h2 class="section-title">校园风采</h2>
        <p class="section-desc">记录校园的每一处风景</p>

        <div class="gallery">
          <div
            v-for="(photo, i) in campusPhotos"
            :key="i"
            class="gallery-item reveal"
            :class="{ 'gallery-item--wide': i === 0 || i === 6 }"
            :style="{ transitionDelay: `${40 * i}ms` }"
          >
            <div class="gallery-card">
              <img :src="photo.src" :alt="photo.alt" loading="lazy" />
              <div class="gallery-overlay">
                <span>{{ photo.alt }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Footer ═══ -->
    <footer class="footer">
      <div class="footer-inner">
        <img :src="logolight" alt="成都东软学院" class="footer-logo" />
        <p class="footer-name">成都东软学院 · NISU-CD 资源系统</p>
        <p class="footer-addr">四川省成都市都江堰市青城山镇东软大道 1 号</p>
        <p class="footer-copy">© 2026 成都东软学院</p>
      </div>
    </footer>
  </div>
  <!-- ═══ 回到顶部（在 landing 外部，避免被 overflow 裁剪） ═══ -->
  <button v-show="showBackToTop" class="back-top" @click="scrollToTop" aria-label="回到顶部">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
  </button>
</template>

<script setup lang="ts">
// ── 介绍页 Landing Page ──
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import heroBg from '@/assets/images/hero1.jpg'
import logolight from '@/assets/images/logo2.jpg'
import logodark from '@/assets/images/logo.jpg'

const logoImg = computed(() => scrolled.value ? logodark : logolight)
import fengjing1 from '@/assets/images/fengjing1.jpg'
import fengjing2 from '@/assets/images/fengjing2.jpg'
import fengjing3 from '@/assets/images/fengjing3.jpg'
import fengjing4 from '@/assets/images/fengjing4.jpg'
import fengjing5 from '@/assets/images/fengjing5.jpg'
import tushuguan1 from '@/assets/images/tushuguan1.jpg'
import tushuguan2 from '@/assets/images/tushuguan2.jpg'

// ── 导航栏滚动变色 + 回到顶部按钮 ──
const scrolled = ref(false)
const showBackToTop = ref(false)
let ticking = false

function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      scrolled.value = window.scrollY > 60
      showBackToTop.value = window.scrollY > 400
      ticking = false
    })
    ticking = true
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── 数字滚动动画 ──
const countUpStarted = ref(false)
const countUp = reactive({
  area: 0,
  units: 0,
  students: 0,
  enterprises: 0,
  countries: 0,
  bases: 0,
})
const countUpTargets = { area: 53, units: 13, students: 3, enterprises: 300, countries: 20, bases: 3 }

function startCountUp() {
  const duration = 1600
  const startTime = performance.now()
  function frame(now: number) {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    for (const [key, target] of Object.entries(countUpTargets)) {
      countUp[key as keyof typeof countUp] = Math.round(eased * target)
    }
    if (progress < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

// ── 初始化观察器 ──
onMounted(() => {
  // 页面加载完成（预留）

  // scroll 监听（导航栏）
  window.addEventListener('scroll', onScroll, { passive: true })

  // 数字滚动：监听 stats 区域进入视口
  const statsEl = document.getElementById('school-stats')
  if (statsEl) {
    const statsObs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !countUpStarted.value) {
          countUpStarted.value = true
          startCountUp()
          statsObs.unobserve(statsEl)
        }
      },
      { threshold: 0.3 },
    )
    statsObs.observe(statsEl)
  }

  // 滚动渐入：监听所有 .reveal 元素
  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          revealObs.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  )
  document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el))
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})

const router = useRouter()

function goLogin() {
  router.push('/login')
}

// ── 平滑滚动至锚点 ──
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// ── 校园照片列表 ──
const campusPhotos = [
  { src: fengjing1, alt: '校园风景' },
  { src: fengjing2, alt: '校园风景' },
  { src: tushuguan1, alt: '学校图书馆' },
  { src: fengjing3, alt: '校园风景' },
  { src: fengjing4, alt: '校园风景' },
  { src: tushuguan2, alt: '学校图书馆' },
  { src: fengjing5, alt: '校园风景' },
]
</script>


<style scoped>
/* ───────────── 滚动渐入动画 ───────────── */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ───────────── 基础重置 ───────────── */
.landing {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1a2332;
  overflow-x: hidden;
}

/* ───────────── 导航栏 ───────────── */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 0 40px;
  transition: all 0.3s ease;
  background: transparent;

}

.navbar--scrolled {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 1px 12px rgba(0, 0, 0, 0.08);
}

.navbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.navbar-logo {
  height: 46px;
  width: auto;
  border-radius: 8px;
}


.navbar-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  transition: color 0.3s;
}

.navbar--scrolled .navbar-title {
  color: #1a2332;
}

.navbar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  background: none;
  border: none;
  padding: 10px 18px;
  font-size: 17px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.navbar--scrolled .nav-link {
  color: #4b5563;
}

.navbar--scrolled .nav-link:hover {
  background: rgba(43, 95, 217, 0.048);
  color: #2b5fd9c2;
}

/* ───────────── Hero ───────────── */
.hero {
  position: relative;
  height: 100vh;
  min-height: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transform: scale(1.08);
  animation: hero-zoom 20s ease-out forwards;
}

@keyframes hero-zoom {
  to { transform: scale(1); }
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(15, 26, 46, 0.82) 0%,
    rgba(15, 26, 46, 0.45) 50%,
    rgba(15, 26, 46, 0.78) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff;
  padding: 0 24px;
  animation: hero-fade 1.2s ease-out;
}

@keyframes hero-fade {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hero-logo {
  height: 72px;
  width: auto;
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.hero-title {
  font-size: 60px;
  font-weight: 800;
  margin: 0 0 12px;
  letter-spacing: 0.02em;
  line-height: 1.2;
  background: #ffffff;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-sub {
  font-size: 20px;
  line-height: 1.7;
  margin: 0 0 40px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.85);
}

.hero-sub strong {
  font-weight: 600;
}

.hero-actions {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 「开始体验」白底蓝字 */
.hero-primary {
  --el-button-bg-color: #fff !important;
  --el-button-border-color: transparent !important;
  --el-button-text-color: #2b5fd9 !important;
  --el-button-hover-bg-color: #f0f4ff !important;
  --el-button-hover-border-color: transparent !important;
  --el-button-hover-text-color: #1e4bb8 !important;
  font-size: 17px !important;
  font-weight: 500 !important;
  padding: 14px 36px !important;
  border-radius: 50px !important;
  box-shadow: 0 4px 20px rgba(43, 95, 217, 0.25);
  transition: all 0.25s ease !important;
}

.hero-primary:hover {
  box-shadow: 0 6px 28px rgba(43, 95, 217, 0.35);
  transform: translateY(-2px);
}

/* 「了解更多」透明底白边框 */
.hero-more {
  --el-button-bg-color: transparent !important;
  --el-button-border-color: rgba(255, 255, 255, 0.7) !important;
  --el-button-text-color: #fff !important;
  --el-button-hover-bg-color: rgba(255, 255, 255, 0.12) !important;
  --el-button-hover-border-color: #fff !important;
  --el-button-hover-text-color: #fff !important;
  font-size: 17px !important;
  font-weight: 500 !important;
  padding: 14px 36px !important;
  border-radius: 50px !important;
}

/* ───────────── 通用 Section ───────────── */
.section {
  padding: 100px 24px;
}

.section--white {
  background: #fff;
}

.section--blue {
  background: linear-gradient(135deg, #0f1a2e 0%, #1a2d4a 100%);
}

.section-inner {
  max-width: 1100px;
  margin: 0 auto;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 8px;
  color: #1a2332;
}

.section-title--light {
  color: #fff;
}

.section-desc {
  font-size: 16px;
  text-align: center;
  color: #6b7280;
  margin: 0 0 60px;
  line-height: 1.6;
}

.section-desc--light {
  color: rgba(255, 255, 255, 0.7);
}

/* ───────────── 产品功能 & 智能问答 ───────────── */
.feature-main {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  background: linear-gradient(135deg, #f8faff 0%, #f0f4fe 100%);
  border-radius: 20px;
  padding: 36px 40px;
  margin-bottom: 32px;
  border: 1px solid rgba(43, 95, 217, 0.08);
}

.feature-main-icon {
  font-size: 48px;
  line-height: 1;
  flex-shrink: 0;
  width: 64px;
  text-align: center;
}

.feature-main-content {
  flex: 1;
}

.feature-main-content h3 {
  font-size: 22px;
  font-weight: 700;
  color: #1a2332;
  margin: 0 0 20px;
}

.feature-flow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.feature-flow-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  transition: all 0.25s ease;
  border: 1px solid transparent;
}

.feature-flow-step:hover {
  border-color: rgba(43, 95, 217, 0.15);
  box-shadow: 0 4px 16px rgba(43, 95, 217, 0.06);
  transform: translateY(-2px);
}

.step-num {
  font-size: 13px;
  font-weight: 700;
  color: #2b5fd9;
  background: #eef3fe;
  padding: 2px 10px;
  border-radius: 20px;
  white-space: nowrap;
  line-height: 22px;
  flex-shrink: 0;
}

.step-text strong {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #1a2332;
  margin-bottom: 2px;
}

.step-text span {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

/* ───────────── 辅助功能卡片 ───────────── */
.feature-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 36px;
}

.feature-card {
  padding: 28px 24px;
  background: #f8fafc;
  border-radius: 16px;
  transition: all 0.3s ease;
  text-align: center;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.feature-card-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 12px;
}

.feature-card h4 {
  font-size: 17px;
  font-weight: 600;
  color: #1a2332;
  margin: 0 0 8px;
}

.feature-card p {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

/* ───────────── 权限说明 ───────────── */
.perm-box {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.perm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background: #f8fafc;
  border-radius: 10px;
  font-size: 14px;
  color: #4b5563;
}

.perm-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.perm-badge--user {
  background: #eef2ff;
  color: #4f6cf7;
}

.perm-badge--admin {
  background: #fef3c7;
  color: #d97706;
}

/* ───────────── 学校概况 ───────────── */
.stats {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.stat-card {
  text-align: center;
  padding: 32px 48px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  min-width: 180px;
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-number {
  display: block;
  font-size: 48px;
  font-weight: 700;
  color: #fff;
  line-height: 1.1;
  margin-bottom: 4px;
}

.stat-number small {
  font-size: 24px;
  font-weight: 600;
}

.stat-unit {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.6);
  margin-left: 2px;
}

.stat-label {
  display: block;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
}

/* ── 第二排数据 ── */
.stats-sub {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.stats-sub-item {
  text-align: center;
  padding: 20px 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 130px;
  transition: transform 0.3s;
}

.stats-sub-item:hover {
  transform: translateY(-2px);
}

.sub-number {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  margin-bottom: 2px;
}

.sub-unit {
  font-size: 16px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.6);
}

.sub-label {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

/* ── 详细介绍 ── */
.school-detail {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.detail-col {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 20px 20px;
  text-align: center;
  transition: all 0.3s;
}

.detail-col:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.detail-col h4 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
  letter-spacing: 0.03em;
}

.detail-col p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0;
  line-height: 1.7;
}

/* ── 底部信息 ── */
.school-footer {
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.school-footer p {
  margin: 0 0 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
}

.school-footer p:first-child {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

/* ───────────── 校园风采 ───────────── */
.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.gallery-item {
  border-radius: 12px;
  overflow: hidden;
}

.gallery-item--wide {
  grid-column: span 2;
}

.gallery-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 4 / 3;
}

.gallery-item--wide .gallery-card {
  aspect-ratio: 5 / 3;
}

.gallery-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.gallery-card:hover img {
  transform: scale(1.08);
}

.gallery-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s;
  display: flex;
  align-items: flex-end;
  padding: 16px;
}

.gallery-card:hover .gallery-overlay {
  opacity: 1;
}

.gallery-overlay span {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

/* ───────────── Footer ───────────── */
.footer {
  background: #0a111f;
  color: rgba(255, 255, 255, 0.6);
  padding: 48px 24px 36px;
  text-align: center;
}

.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
}

.footer-logo {
  height: 40px;
  width: auto;
  margin-bottom: 16px;
  border-radius: 4px;
  opacity: 0.8;
}

.footer-name {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 8px;
}

.footer-addr {
  font-size: 13px;
  margin: 0 0 20px;
}

.footer-copy {
  font-size: 12px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}


/* ───────────── 回到顶部 ───────────── */
.back-top {
  position: fixed;
  right: 32px;
  bottom: 40px;
  z-index: 1900;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: #9f9fa0b6;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(43, 95, 217, 0.281);
  transition: all 0.25s ease;
}

.back-top:hover {
  background: #676869;
  transform: translateY(-3px);
  box-shadow: 0 6px 28px rgba(43, 95, 217, 0.233);
}

.back-top:active {
  transform: translateY(0);
}

.back-top svg {
  width: 22px;
  height: 22px;
  stroke: #fff;
}

/* ───────────── 响应式 ───────────── */
@media (max-width: 900px) {
  .hero-title { font-size: 36px; }
  .hero-sub { font-size: 17px; }
  .hero-logo { height: 56px; }
  .gallery { grid-template-columns: repeat(2, 1fr); }
  .gallery-item--wide { grid-column: span 1; }
  .gallery-item--wide .gallery-card { aspect-ratio: 4 / 3; }
  .stat-card { min-width: 140px; padding: 28px 32px; }
  .stat-number { font-size: 38px; }
  .school-detail { grid-template-columns: 1fr; }
  .navbar-title { display: none; }
  .nav-link { display: none; }
}

@media (max-width: 600px) {
  .hero-title { font-size: 28px; }
  .hero-sub { font-size: 15px; }
  .section { padding: 60px 16px; }
  .gallery { grid-template-columns: 1fr; }
  .feature-flow { grid-template-columns: 1fr; }
  .feature-cards { grid-template-columns: 1fr; }
  .feature-main { flex-direction: column; padding: 24px; }
  .stats { flex-direction: column; align-items: center; }
  .stats-sub { flex-direction: column; align-items: center; }
  .school-detail { grid-template-columns: 1fr; }
  .navbar { padding: 0 16px; }
}
</style>
