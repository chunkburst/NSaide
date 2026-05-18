(function() {
    'use strict';
    
    console.log('[NS助手] levelTag 模块开始加载');

    const NSLevelTag = {
        id: 'levelTag',
        name: '等级标签',
        description: '为用户名和帖子添加等级标签显示',

        settings: {
            items: [
                {
                    id: 'enable_level_tag',
                    type: 'switch',
                    label: '显示用户等级标签',
                    default: true,
                    value: () => GM_getValue('ns_leveltag_enable_level_tag', true)
                },
                {
                    id: 'level_tag_position',
                    type: 'select',
                    label: '等级标签位置',
                    options: [
                        { value: 'before_name', label: '用户名前' },
                        { value: 'after_name', label: '用户名后' },
                        { value: 'after_tags', label: '所有标签后' }
                    ],
                    default: 'before_name',
                    value: () => GM_getValue('ns_leveltag_level_tag_position', 'before_name')
                },
                {
                    id: 'enable_post_level_tag',
                    type: 'switch',
                    label: '显示帖子列表等级标签',
                    default: true,
                    value: () => GM_getValue('ns_leveltag_enable_post_level_tag', true)
                },
                {
                    id: 'post_level_tag_position',
                    type: 'select',
                    label: '帖子列表等级标签位置',
                    options: [
                        { value: 'before_title', label: '标题前' },
                        { value: 'before_name', label: '用户名前' },
                        { value: 'after_name', label: '用户名后' }
                    ],
                    default: 'after_name',
                    value: () => GM_getValue('ns_leveltag_post_level_tag_position', 'after_name')
                }
            ],
            
            handleChange(settingId, value, settingsManager) {
                if (settingId === 'enable_level_tag') {
                    settingsManager.cacheValue('ns_leveltag_enable_level_tag', value);
                    if (!value) {
                        document.querySelectorAll('.ns-level-tag').forEach(tag => tag.remove());
                    } else {
                        NSLevelTag.enhancePageUserLevels();
                    }
                } else if (settingId === 'level_tag_position') {
                    settingsManager.cacheValue('ns_leveltag_level_tag_position', value);
                    NSLevelTag.enhancePageUserLevels();
                } else if (settingId === 'enable_post_level_tag') {
                    settingsManager.cacheValue('ns_leveltag_enable_post_level_tag', value);
                    if (!value) {
                        document.querySelectorAll('.ns-post-level-tag').forEach(tag => tag.remove());
                    } else {
                        NSLevelTag.enhancePostLevels();
                    }
                } else if (settingId === 'post_level_tag_position') {
                    settingsManager.cacheValue('ns_leveltag_post_level_tag_position', value);
                    NSLevelTag.enhancePostLevels();
                }
            }
        },

        utils: {
            userDataCache: new Map(),
            maxCacheSize: 100,
            processingUsers: new Set(),

            clearOldCache() {
                if (this.userDataCache.size > this.maxCacheSize) {
                    const entries = Array.from(this.userDataCache.entries());
                    const halfSize = Math.floor(this.maxCacheSize / 2);
                    entries.slice(0, entries.length - halfSize).forEach(([key]) => {
                        this.userDataCache.delete(key);
                    });
                }
            },

            async waitForElement(selector, parent = document, timeout = 10000) {
                const element = parent.querySelector(selector);
                if (element) return element;
            
                return new Promise((resolve) => {
                    const observer = new MutationObserver((mutations, obs) => {
                        const element = parent.querySelector(selector);
                        if (element) {
                            obs.disconnect();
                            resolve(element);
                        }
                    });
            
                    observer.observe(parent, {
                        childList: true,
                        subtree: true
                    });

                    setTimeout(() => {
                        observer.disconnect();
                        resolve(null);
                    }, timeout);
                });
            },

            async getUserInfo(userId) {
                try {
                    if (this.processingUsers.has(userId)) {
                        return this.userDataCache.get(userId) || null;
                    }

                    if (this.userDataCache.has(userId)) {
                        return this.userDataCache.get(userId);
                    }

                    this.processingUsers.add(userId);
                    console.log(`[NS助手] 获取用户数据: ${userId}`);
                    
                    const response = await fetch(`https://www.nodeseek.com/api/account/getInfo/${userId}`, {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    if (!data.success) {
                        throw new Error('Failed to get user info');
                    }
                    
                    this.clearOldCache();
                    this.userDataCache.set(userId, data.detail);
                    this.processingUsers.delete(userId);
                    return data.detail;
                } catch (error) {
                    console.error('[NS助手] 获取用户信息失败:', error);
                    this.processingUsers.delete(userId);
                    return null;
                }
            }
        },

        async enhancePageUserLevels() {
            try {
                if (!GM_getValue('ns_leveltag_enable_level_tag', true)) {
                    return;
                }

                const authorInfoElements = document.querySelectorAll('.author-info:not([data-ns-level-processed])');
                const position = GM_getValue('ns_leveltag_level_tag_position', 'before_name');
                
                for (const authorInfo of authorInfoElements) {
                    const authorLink = authorInfo.querySelector('a.author-name');
                    if (!authorLink) continue;

                    const userId = authorLink.getAttribute('href').split('/').pop();
                    const userInfo = await this.utils.getUserInfo(userId);
                    
                    if (!userInfo) continue;

                    if (authorInfo.hasAttribute('data-ns-level-processed')) {
                        continue;
                    }

                    authorInfo.querySelectorAll('.ns-level-tag').forEach(tag => tag.remove());

                    const levelTag = document.createElement('span');
                    levelTag.className = 'nsk-badge role-tag ns-level-tag';
                    levelTag.innerHTML = `Lv.${userInfo.rank}`;
                    levelTag.setAttribute('data-level', userInfo.rank);
                    levelTag.setAttribute('data-user-id', userId);

                    const tooltip = document.createElement('div');
                    tooltip.className = 'ns-level-tooltip';
                    tooltip.innerHTML = `
                        <div class="ns-level-tooltip-item">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                            注册时间：${userInfo.created_at_str}
                        </div>
                        <div class="ns-level-tooltip-item">
                            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4z"/></svg>
                            发帖数量：${userInfo.nPost}
                        </div>
                        <div class="ns-level-tooltip-item">
                            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                            评论数量：${userInfo.nComment}
                        </div>
                    `;
                    document.body.appendChild(tooltip);

                    const updateTooltipPosition = (e) => {
                        const rect = levelTag.getBoundingClientRect();
                        const tooltipRect = tooltip.getBoundingClientRect();
                        
                        let left = rect.left + (rect.width - tooltipRect.width) / 2;
                        let top = rect.bottom + 5;

                        if (left < 10) left = 10;
                        if (left + tooltipRect.width > window.innerWidth - 10) {
                            left = window.innerWidth - tooltipRect.width - 10;
                        }
                        if (top + tooltipRect.height > window.innerHeight - 10) {
                            top = rect.top - tooltipRect.height - 5;
                        }

                        tooltip.style.left = `${left}px`;
                        tooltip.style.top = `${top}px`;
                    };

                    levelTag.addEventListener('mouseenter', () => {
                        tooltip.classList.add('show');
                        updateTooltipPosition();
                    });

                    levelTag.addEventListener('mouseleave', () => {
                        tooltip.classList.remove('show');
                    });

                    window.addEventListener('scroll', () => {
                        if (tooltip.classList.contains('show')) {
                            updateTooltipPosition();
                        }
                    }, { passive: true });
                    
                    switch (position) {
                        case 'before_name':
                            authorLink.parentNode.insertBefore(levelTag, authorLink);
                            break;
                        case 'after_name':
                            authorLink.parentNode.insertBefore(levelTag, authorLink.nextSibling);
                            break;
                        case 'after_tags':
                            authorInfo.appendChild(levelTag);
                            break;
                    }
                    
                    authorInfo.setAttribute('data-ns-level-processed', 'true');
                }
            } catch (error) {
                console.error('[NS助手] 增强页面用户等级显示时出错:', error);
            }
        },

        async enhancePostLevels() {
            try {
                if (!GM_getValue('ns_leveltag_enable_post_level_tag', true)) {
                    return;
                }

                const postListContents = document.querySelectorAll('.post-list-content:not([data-ns-level-processed])');
                const position = GM_getValue('ns_leveltag_post_level_tag_position', 'after_name');
                
                for (const postContent of postListContents) {
                    const authorLink = postContent.querySelector('.info-author a');
                    if (!authorLink) continue;

                    const userId = authorLink.getAttribute('href').split('/').pop();
                    const userInfo = await this.utils.getUserInfo(userId);
                    
                    if (!userInfo) continue;

                    if (postContent.hasAttribute('data-ns-level-processed')) {
                        continue;
                    }

                    postContent.querySelectorAll('.ns-post-level-tag').forEach(tag => tag.remove());

                    const levelTag = document.createElement('span');
                    levelTag.className = 'nsk-badge role-tag ns-level-tag ns-post-level-tag';
                    levelTag.innerHTML = `Lv.${userInfo.rank}`;
                    levelTag.setAttribute('data-level', userInfo.rank);
                    levelTag.setAttribute('data-user-id', userId);

                    const tooltip = document.createElement('div');
                    tooltip.className = 'ns-level-tooltip';
                    tooltip.innerHTML = `
                        <div class="ns-level-tooltip-item">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                            注册时间：${userInfo.created_at_str}
                        </div>
                        <div class="ns-level-tooltip-item">
                            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4z"/></svg>
                            发帖数量：${userInfo.nPost}
                        </div>
                        <div class="ns-level-tooltip-item">
                            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                            评论数量：${userInfo.nComment}
                        </div>
                    `;
                    document.body.appendChild(tooltip);

                    const updateTooltipPosition = (e) => {
                        const rect = levelTag.getBoundingClientRect();
                        const tooltipRect = tooltip.getBoundingClientRect();
                        
                        let left = rect.left + (rect.width - tooltipRect.width) / 2;
                        let top = rect.bottom + 5;

                        if (left < 10) left = 10;
                        if (left + tooltipRect.width > window.innerWidth - 10) {
                            left = window.innerWidth - tooltipRect.width - 10;
                        }
                        if (top + tooltipRect.height > window.innerHeight - 10) {
                            top = rect.top - tooltipRect.height - 5;
                        }

                        tooltip.style.left = `${left}px`;
                        tooltip.style.top = `${top}px`;
                    };

                    levelTag.addEventListener('mouseenter', () => {
                        tooltip.classList.add('show');
                        updateTooltipPosition();
                    });

                    levelTag.addEventListener('mouseleave', () => {
                        tooltip.classList.remove('show');
                    });

                    window.addEventListener('scroll', () => {
                        if (tooltip.classList.contains('show')) {
                            updateTooltipPosition();
                        }
                    }, { passive: true });
                    
                    switch (position) {
                        case 'before_title':
                            const titleElement = postContent.querySelector('.post-title');
                            if (titleElement) {
                                titleElement.insertBefore(levelTag, titleElement.firstChild);
                            }
                            break;
                        case 'before_name':
                            authorLink.parentNode.insertBefore(levelTag, authorLink);
                            break;
                        case 'after_name':
                            authorLink.parentNode.insertBefore(levelTag, authorLink.nextSibling);
                            break;
                    }
                    
                    postContent.setAttribute('data-ns-level-processed', 'true');
                }
            } catch (error) {
                console.error('[NS助手] 增强帖子列表等级显示时出错:', error);
            }
        },

        init() {
            console.log('[NS助手] 初始化等级标签模块');
            
            this.enhancePageUserLevels = this.enhancePageUserLevels.bind(this);
            this.enhancePostLevels = this.enhancePostLevels.bind(this);

            console.log('[NS助手] 开始加载等级标签样式');
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/chunkburst/NSaide/main/modules/levelTag/style.css',
                onload: (response) => {
                    if (response.status === 200) {
                        console.log('[NS助手] 等级标签样式加载成功');
                        GM_addStyle(response.responseText);
                    } else {
                        console.error('[NS助手] 加载等级标签样式失败:', response.status);
                    }
                },
                onerror: (error) => {
                    console.error('[NS助手] 加载等级标签样式出错:', error);
                }
            });

            if (GM_getValue('ns_leveltag_enable_level_tag', true)) {
                this.enhancePageUserLevels();
            }

            if (GM_getValue('ns_leveltag_enable_post_level_tag', true)) {
                this.enhancePostLevels();
            }

            const observer = new MutationObserver((mutations) => {
                let shouldEnhanceLevels = false;
                let shouldEnhancePostLevels = false;
                let themeChanged = false;

                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.classList?.contains('author-info') || node.querySelector?.('.author-info')) {
                                    shouldEnhanceLevels = true;
                                }
                                if (node.classList?.contains('post-list-content') || node.querySelector?.('.post-list-content')) {
                                    shouldEnhancePostLevels = true;
                                }
                            }
                        });
                    } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        themeChanged = true;
                    }
                });

                if (shouldEnhanceLevels && GM_getValue('ns_leveltag_enable_level_tag', true)) {
                    this.enhancePageUserLevels();
                }

                if (shouldEnhancePostLevels && GM_getValue('ns_leveltag_enable_post_level_tag', true)) {
                    this.enhancePostLevels();
                }

                if (themeChanged) {
                    const newTheme = document.body.classList.contains('dark-layout') ? 'dark' : 'light';
                    console.log('[NS助手] 主题切换:', newTheme);
                    
                    const levelTags = document.querySelectorAll('.ns-level-tag');
                    levelTags.forEach(tag => {
                        if (newTheme === 'dark') {
                            tag.style.backgroundColor = '#111b26';
                            tag.style.border = '1px solid #153450';
                        } else {
                            tag.style.backgroundColor = '#e6f4ff';
                            tag.style.border = '1px solid #91d5ff';
                        }
                    });
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });

            console.log('[NS助手] 等级标签模块初始化完成');
        }
    };

    console.log('[NS助手] 等待模块系统就绪');
    let retryCount = 0;
    const maxRetries = 50;

    const waitForNS = () => {
        retryCount++;
        console.log(`[NS助手] 第 ${retryCount} 次尝试注册 levelTag 模块`);
        
        if (typeof window.NSRegisterModule === 'function') {
            console.log('[NS助手] 模块系统就绪，开始注册 levelTag');
            window.NSRegisterModule(NSLevelTag);
            console.log('[NS助手] levelTag 模块注册请求已发送');
        } else {
            console.log('[NS助手] 模块系统未就绪');
            if (retryCount < maxRetries) {
                setTimeout(waitForNS, 100);
            } else {
                console.error('[NS助手] 模块系统等待超时，levelTag 模块注册失败');
            }
        }
    };

    waitForNS();
    console.log('[NS助手] levelTag 模块加载完成 v0.1.1');
})(); 
