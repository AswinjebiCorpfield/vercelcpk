import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 576 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 576 && window.innerWidth < 992 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 992 : true
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      setScreenSize({
        width,
        height: window.innerHeight,
        isMobile: width < 576,
        isTablet: width >= 576 && width < 992,
        isDesktop: width >= 992
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenSize;
};

export const useBreakpoint = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    // 便捷方法
    showOnMobile: (content, fallback = null) => isMobile ? content : fallback,
    showOnTablet: (content, fallback = null) => isTablet ? content : fallback,
    showOnDesktop: (content, fallback = null) => isDesktop ? content : fallback,
    hideOnMobile: (content) => !isMobile ? content : null,
    hideOnTablet: (content) => !isTablet ? content : null,
    hideOnDesktop: (content) => !isDesktop ? content : null
  };
};