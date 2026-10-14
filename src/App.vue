<script setup lang="ts">
// App.vue 只是容器：負責全站共用的紙張紋理背景與換頁動畫
</script>

<template>
  <div class="paper-bg" aria-hidden="true"></div>

  <div class="relative z-10">
    <router-view v-slot="{ Component, route }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
  </div>
</template>
