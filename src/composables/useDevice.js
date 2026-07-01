export function useDevice() {
  // 判断是否移动端
  const isMobile = () => {
    const ua = navigator.userAgent.toLowerCase()
    return /android|iphone|ipad|ipod/.test(ua)
  }
  // 判断是否PC端
  const isPc = () => !isMobile()

  return {
    isMobile,
    isPc,
  }
}
