(function() {
    'use strict';

    console.log('[NS助手] userCard 模块开始加载');

    const NSUserCard = {
        id: 'userCard',
        name: '用户卡片增强',
        description: '增强用户信息卡片，添加等级进度和活跃度统计',

        settings: {
            items: [
                {
                    id: 'enable_dragging',
                    type: 'switch',
                    label: '启用卡片拖拽',
                    default: true,
                    value: () => GM_getValue('ns_usercard_enable_dragging', true)
                },
                {
                    id: 'enable_block',
                    type: 'switch',
                    label: '启用用户屏蔽',
                    default: true,
                    value: () => GM_getValue('ns_usercard_enable_block', true)
                }
            ],
            
            handleChange(settingId, value, settingsManager) {
                if (settingId === 'enable_dragging') {
                    settingsManager.cacheValue('ns_usercard_enable_dragging', value);
                }
                if (settingId === 'enable_block') {
                    settingsManager.cacheValue('ns_usercard_enable_block', value);
                }
            }
        },

        utils: {
            userDataCache: new Map(),
            maxCacheSize: 100,

            showConfirm(title, content) {
                return new Promise((resolve) => {
                    const overlay = document.createElement('div');
                    overlay.className = 'ns-confirm-overlay';
                    
                    const dialog = document.createElement('div');
                    dialog.className = 'ns-confirm-dialog';
                    
                    dialog.innerHTML = `
                        <div class="ns-confirm-title">${title}</div>
                        <div class="ns-confirm-content">${content}</div>
                        <div class="ns-confirm-actions">
                            <button class="ns-confirm-btn ns-confirm-btn-cancel">取消</button>
                            <button class="ns-confirm-btn ns-confirm-btn-confirm">确定</button>
                        </div>
                    `;
                    
                    document.body.appendChild(overlay);
                    document.body.appendChild(dialog);
                    
                    const close = (result) => {
                        overlay.remove();
                        dialog.remove();
                        resolve(result);
                    };
                    
                    dialog.querySelector('.ns-confirm-btn-cancel').onclick = () => close(false);
                    dialog.querySelector('.ns-confirm-btn-confirm').onclick = () => close(true);
                    overlay.onclick = () => close(false);
                });
            },

            showAlert(message, type = 'success') {
                const alert = document.createElement('div');
                alert.className = `ns-alert ns-alert-${type}`;
                
                alert.innerHTML = `
                    <span class="ns-alert-icon">${type === 'success' ? '✓' : '✕'}</span>
                    <span class="ns-alert-content">${message}</span>
                `;
                
                document.body.appendChild(alert);
                
                setTimeout(() => {
                    alert.style.opacity = '0';
                    alert.style.transform = 'translateX(20px)';
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            },

            async blockUser(userName) {
                console.log('[NS助手] 尝试屏蔽用户:', userName);
                try {
                    const response = await fetch('https://www.nodeseek.com/api/block-list/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            block_member_name: userName
                        }),
                        credentials: 'include'
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        console.log('[NS助手] 用户屏蔽成功:', userName);
                        this.showAlert(`用户 ${userName} 已被屏蔽`, 'success');
                    } else {
                        console.error('[NS助手] 用户屏蔽失败:', data.message);
                        this.showAlert(`屏蔽失败: ${data.message}`, 'error');
                    }
                    return data.success;
                } catch (error) {
                    console.error('[NS助手] 屏蔽请求失败:', error);
                    this.showAlert('屏蔽请求失败', 'error');
                    return false;
                }
            },

            clearOldCache() {
                console.log('[NS助手] 检查缓存大小:', this.userDataCache.size);
                if (this.userDataCache.size > this.maxCacheSize) {
                    console.log('[NS助手] 清理过期缓存');
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
                    if (this.userDataCache.has(userId)) {
                        console.log(`[NS助手] 使用缓存的用户数据: ${userId}`);
                        return this.userDataCache.get(userId);
                    }

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
                    return data.detail;
                } catch (error) {
                    console.error('[NS助手] 获取用户信息失败:', error);
                    return null;
                }
            },

            calculateNextLevelInfo(currentLevel, currentChickenLegs) {
                if (currentLevel >= 6) {
                    return {
                        isMaxLevel: true,
                        nextLevel: 6,
                        remaining: 0,
                        progress: 100
                    };
                }
            
                const nextLevel = currentLevel + 1;
                const requiredChickenLegs = 100 * Math.pow(nextLevel, 2);
                const remaining = Math.max(0, requiredChickenLegs - currentChickenLegs);
                const progress = Math.min(100, (currentChickenLegs / requiredChickenLegs) * 100);
            
                return {
                    isMaxLevel: false,
                    nextLevel,
                    remaining: Math.round(remaining),
                    progress: Math.round(progress)
                };
            },

            calculateActivity(joinDays, posts, comments, chickenLegs, rank, bio) {
                if (joinDays === 0) {
                    return {
                        score: 0,
                        finalScore: bio ? 5 : 0,
                        level: 'low',
                        dailyPosts: '0.00',
                        dailyComments: '0.00',
                        dailyChickenLegs: '0.00',
                        joinDays: 0,
                        details: {
                            postScore: 0,
                            commentScore: 0,
                            chickenScore: 0,
                            rankScore: 0,
                            bioBonus: bio ? 5 : 0
                        }
                    };
                }

                const dailyPosts = (posts / joinDays).toFixed(2);
                const dailyComments = (comments / joinDays).toFixed(2);
                const dailyChickenLegs = (chickenLegs / joinDays).toFixed(2);

                let postScore = 0;
                if (dailyPosts >= 0.5) postScore = 30;
                else if (dailyPosts >= 0.25) postScore = 25;
                else if (dailyPosts >= 0.15) postScore = 20;
                else if (dailyPosts >= 0.07) postScore = 15;
                else postScore = 10;

                let commentScore = 0;
                if (dailyComments >= 1) commentScore = 25;
                else if (dailyComments >= 0.5) commentScore = 20;
                else if (dailyComments >= 0.25) commentScore = 15;
                else if (dailyComments >= 0.15) commentScore = 10;
                else commentScore = 5;

                let chickenScore = 0;
                if (dailyChickenLegs >= 10) chickenScore = 15;
                else if (dailyChickenLegs >= 7) chickenScore = 12;
                else if (dailyChickenLegs >= 5) chickenScore = 9;
                else if (dailyChickenLegs >= 3) chickenScore = 6;
                else chickenScore = 3;

                let rankScore = 0;
                if (rank > 0) {
                    if (rank >= 6) rankScore = 30;
                    else if (rank >= 5) rankScore = 25;
                    else if (rank >= 4) rankScore = 20;
                    else if (rank >= 3) rankScore = 15;
                    else if (rank >= 2) rankScore = 10;
                    else rankScore = 5;
                }

                let totalScore = postScore + commentScore + chickenScore + rankScore;
                let bioBonus = bio ? 5 : 0;
                
                return {
                    score: totalScore,
                    finalScore: totalScore + bioBonus,
                    level: this.getActivityLevel(totalScore),
                    dailyPosts,
                    dailyComments,
                    dailyChickenLegs,
                    joinDays,
                    details: {
                        postScore,
                        commentScore,
                        chickenScore,
                        rankScore,
                        bioBonus
                    }
                };
            },

            getActivityLevel(score) {
                if (score >= 85) return 'high';
                if (score >= 60) return 'medium';
                return 'low';
            },

            extractJoinDays(createdAtStr) {
                const match = createdAtStr.match(/(\d+)days/);
                return match ? parseInt(match[1]) : 0;
            }
        },

        init() {
            console.log('[NS助手] 初始化用户卡片增强功能');
            
            this.waitAndEnhance = this.waitAndEnhance.bind(this);
            this.enhance = this.enhance.bind(this);
            this.enableDragging = this.enableDragging.bind(this);

            console.log('[NS助手] 开始加载用户卡片样式');
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/chunkburst/NSaide/main/modules/userCard/style.css',
                onload: (response) => {
                    if (response.status === 200) {
                        console.log('[NS助手] 用户卡片样式加载成功');
                        GM_addStyle(response.responseText);
                    } else {
                        console.error('[NS助手] 加载用户卡片样式失败:', response.status);
                    }
                },
                onerror: (error) => {
                    console.error('[NS助手] 加载用户卡片样式出错:', error);
                }
            });

            console.log('[NS助手] 注册头像点击监听器');
            document.addEventListener('click', async (e) => {
                const avatarLink = e.target.closest('a[href^="/space/"]');
                if (avatarLink && avatarLink.querySelector('img.avatar-normal')) {
                    console.log('[NS助手] 检测到头像点击');
                    const userId = avatarLink.getAttribute('href').split('/').pop();
                    this.waitAndEnhance(userId);
                }
            });

            const observer = new MutationObserver((mutations) => {
                let themeChanged = false;

                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        themeChanged = true;
                    }
                });

                if (themeChanged) {
                    const newTheme = document.body.classList.contains('dark-layout') ? 'dark' : 'light';
                    console.log('[NS助手] 主题切换:', newTheme);
                    
                    const cards = document.querySelectorAll('.hover-user-card');
                    cards.forEach(card => {
                        if (card.classList.contains('enhanced')) {
                            console.log('[NS助手] 重新渲染卡片以适应新主题');
                            card.classList.remove('enhanced');
                            card.classList.remove('ns-usercard-enhanced');
                            const extension = card.querySelector('.ns-usercard-extension');
                            if (extension) {
                                extension.remove();
                            }
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

            console.log('[NS助手] 用户卡片模块初始化完成');
        },

        enableDragging(cardElement) {
            let isDragging = false;
            let startX;
            let startY;
            let startLeft;
            let startTop;

            const dragStart = (e) => {
                if (e.target.tagName.toLowerCase() === 'a' || 
                    e.target.tagName.toLowerCase() === 'button' ||
                    e.target.closest('a') || 
                    e.target.closest('button')) {
                    return;
                }

                const rect = cardElement.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;

                startX = e.clientX;
                startY = e.clientY;

                if (e.target === cardElement || cardElement.contains(e.target)) {
                    isDragging = true;
                    cardElement.classList.add('dragging');
                }
            };

            const dragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                cardElement.classList.remove('dragging');
            };

            const drag = (e) => {
                if (!isDragging) return;
                e.preventDefault();

                const moveX = e.clientX - startX;
                const moveY = e.clientY - startY;

                cardElement.style.left = `${startLeft + moveX}px`;
                cardElement.style.top = `${startTop + moveY}px`;
            };

            cardElement.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);

            return () => {
                cardElement.removeEventListener('mousedown', dragStart);
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', dragEnd);
            };
        },

        async waitAndEnhance(userId) {
            try {
                console.log('[NS助手] 等待卡片出现...');

                const card = await this.utils.waitForElement('.hover-user-card');
                if (!card) {
                    console.log('[NS助手] 未找到卡片');
                    return;
                }

                if (card.querySelector('.ns-usercard-extension')) {
                    console.log('[NS助手] 移除旧的扩展内容');
                    card.querySelector('.ns-usercard-extension').remove();
                }

                console.log('[NS助手] 找到卡片，获取用户数据...');
                const userInfo = await this.utils.getUserInfo(userId);
                if (!userInfo) {
                    console.log('[NS助手] 获取用户数据失败');
                    return;
                }

                console.log('[NS助手] 用户数据获取完成，开始增强');
                this.enhance(card, userInfo);
              
                if (GM_getValue('ns_usercard_enable_dragging', true)) {
                    this.enableDragging(card);
                }

            } catch (error) {
                console.error('[NS助手] 等待卡片时出错:', error);
            }
        },

        enhance(cardElement, userInfo) {
            try {
                console.log('[NS助手] 开始增强卡片');
                const isDarkMode = document.body.classList.contains('dark-layout');
                console.log('[NS助手] 当前主题模式:', isDarkMode ? 'dark' : 'light');

                if (GM_getValue('ns_usercard_enable_block', true)) {
                    console.log('[NS助手] 添加屏蔽按钮');
                    const actionArea = cardElement.querySelector('div[style*="text-align: right"]');
                    if (actionArea) {
                        const blockBtn = document.createElement('a');
                        blockBtn.className = 'btn ns-block-btn';
                        blockBtn.textContent = '屏蔽';
                        blockBtn.href = 'javascript:void(0)';
                        
                        const tooltip = document.createElement('span');
                        tooltip.className = 'ns-block-tooltip';
                        tooltip.textContent = '将此用户加入屏蔽列表';
                        blockBtn.appendChild(tooltip);
                        
                        blockBtn.onclick = async (e) => {
                            e.preventDefault();
                            const username = cardElement.querySelector('a.Username').textContent;
                            const confirmed = await this.utils.showConfirm(
                                '确认屏蔽',
                                `确定要将用户 "${username}" 加入屏蔽列表吗？<br>你可以在设置=>屏蔽用户中解除屏蔽`
                            );
                            if (confirmed) {
                                await this.utils.blockUser(username);
                            }
                        };
                        
                        actionArea.insertBefore(blockBtn, actionArea.firstChild);
                    } else {
                        console.log('[NS助手] 未找到操作区域');
                    }
                }

                const userData = {
                    level: userInfo.rank,
                    chickenLegs: userInfo.coin,
                    posts: userInfo.nPost,
                    comments: userInfo.nComment,
                    joinDays: this.utils.extractJoinDays(userInfo.created_at_str),
                    memberId: userInfo.member_id
                };

                console.log('[NS助手] 提取的用户数据:', userData);

                const nextLevelInfo = this.utils.calculateNextLevelInfo(userData.level, userData.chickenLegs);
                const activity = this.utils.calculateActivity(
                    userData.joinDays,
                    userData.posts,
                    userData.comments,
                    userData.chickenLegs,
                    userData.level,
                    userInfo.bio
                );

                const extensionDiv = document.createElement('div');
                extensionDiv.className = 'ns-usercard-extension';

                const userIdDiv = document.createElement('div');
                userIdDiv.className = 'ns-usercard-userid';
                userIdDiv.innerHTML = `🆔 用户ID：${userData.memberId}`;
                extensionDiv.appendChild(userIdDiv);

                const nextLevelDiv = document.createElement('div');
                nextLevelDiv.className = nextLevelInfo.isMaxLevel ?
                    'ns-usercard-next-level ns-usercard-max-level' :
                    'ns-usercard-next-level';

                if (nextLevelInfo.isMaxLevel) {
                    nextLevelDiv.innerHTML = `
                        <div class="ns-usercard-next-level-title">🌟 最高等级</div>
                        <div class="ns-usercard-next-level-detail">
                            此用户已达到最高等级 Lv.6
                        </div>
                    `;
                } else {
                    nextLevelDiv.innerHTML = `
                        <div class="ns-usercard-next-level-title">⭐ 等级进度</div>
                        <div class="ns-usercard-next-level-detail">
                            距离 Lv.${nextLevelInfo.nextLevel} 还需 ${nextLevelInfo.remaining} 鸡腿
                        </div>
                        <div class="ns-usercard-next-level-progress">
                            <div class="ns-usercard-next-level-progress-bar" style="width: ${nextLevelInfo.progress}%"></div>
                        </div>
                    `;
                }

                const activityDiv = document.createElement('div');
                activityDiv.className = `ns-usercard-activity ns-usercard-activity-${activity.level}`;

                let activityHtml = `
                    <div class="ns-usercard-activity-title">
                        ${activity.level === 'high' ? '🔥' : activity.level === 'medium' ? '⭐' : '💫'}
                        可靠性指数
                        <span class="ns-usercard-activity-score">${activity.finalScore}分</span>
                    </div>
                    <div class="ns-usercard-activity-detail">
                        📝 发帖频率：${activity.dailyPosts}篇/天 (${activity.details.postScore}分)
                        <br>
                        💬 评论频率：${activity.dailyComments}条/天 (${activity.details.commentScore}分)
                        <br>
                        🍗 鸡腿效率：${activity.dailyChickenLegs}个/天 (${activity.details.chickenScore}分)
                        <br>
                        👑 用户等级：Lv.${userInfo.rank} (${activity.details.rankScore}分)
                        ${userInfo.bio ? '<br>📝 个性签名 (+5分)' : ''}
                        <br>
                        ⌛ 注册时长：${activity.joinDays}天
                    </div>
                `;

                activityDiv.innerHTML = activityHtml;

                extensionDiv.appendChild(nextLevelDiv);
                extensionDiv.appendChild(activityDiv);

                const closeBtn = cardElement.querySelector('.closeBtn');
                if (closeBtn) {
                    cardElement.insertBefore(extensionDiv, closeBtn);
                } else {
                    cardElement.appendChild(extensionDiv);
                }

                console.log('[NS助手] 卡片增强完成');

            } catch (error) {
                console.error('[NS助手] 数据处理错误:', error);
            }
        }
    };

    console.log('[NS助手] 等待模块系统就绪');
    let retryCount = 0;
    const maxRetries = 50;

    const waitForNS = () => {
        retryCount++;
        console.log(`[NS助手] 第 ${retryCount} 次尝试注册 userCard 模块`);
        
        if (typeof window.NSRegisterModule === 'function') {
            console.log('[NS助手] 模块系统就绪，开始注册 userCard');
            window.NSRegisterModule(NSUserCard);
            console.log('[NS助手] userCard 模块注册请求已发送');
        } else {
            console.log('[NS助手] 模块系统未就绪');
            if (retryCount < maxRetries) {
                setTimeout(waitForNS, 100);
            } else {
                console.error('[NS助手] 模块系统等待超时，userCard 模块注册失败');
            }
        }
    };

    waitForNS();
    console.log('[NS助手] userCard 模块加载完成 v0.1.5');
})();
