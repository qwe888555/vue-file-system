<script setup lang="ts">
defineProps<{
  search: string
  format: string
  college: string
  uploader: string
  formatOptions: string[]
  collegeOptions: string[]
  uploaderOptions: string[]
}>()

defineEmits<{
  (e: 'update:search', v: string): void
  (e: 'update:format', v: string): void
  (e: 'update:college', v: string): void
  (e: 'update:uploader', v: string): void
}>()
</script>

<template>
  <div class="search-section">
    <el-input
      :model-value="search"
      placeholder="搜索资料名、上传单位、上传者、上传时间、资料描述..."
      prefix-icon="Search"
      class="search-input"
      @update:model-value="$emit('update:search', $event)"
    />
    <el-select
      :model-value="format"
      clearable
      placeholder="文件格式"
      class="filter-select format-filter"
      @update:model-value="$emit('update:format', $event)"
    >
      <el-option label="全部" value="" />
      <el-option v-for="opt in formatOptions" :key="opt" :label="opt" :value="opt" />
    </el-select>
    <el-select
      :model-value="college"
      clearable
      placeholder="上传单位"
      class="filter-select college-filter"
      @update:model-value="$emit('update:college', $event)"
    >
      <el-option label="全部" value="" />
      <el-option v-for="opt in collegeOptions" :key="opt" :label="opt" :value="opt" />
    </el-select>
    <el-select
      :model-value="uploader"
      clearable
      placeholder="上传者"
      class="filter-select uploader-filter"
      @update:model-value="$emit('update:uploader', $event)"
    >
      <el-option label="全部" value="" />
      <el-option v-for="opt in uploaderOptions" :key="opt" :label="opt" :value="opt" />
    </el-select>
  </div>
</template>

<style scoped>
.search-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--spacing-xl);
}

.search-input {
  flex: 1;
  min-width: 260px;
  max-width: 420px;
}

.filter-select {
  width: 150px;
}

.filter-select.format-filter {
  width: 130px;
}

.filter-select.college-filter {
  width: 170px;
}
</style>
