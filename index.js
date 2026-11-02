const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL || '@gruppasnews';

let newsCache = [];
let lastUpdateId = 0; // Для отслеживания полученных сообщений

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    try {
        // Запрос к Telegram Bot API с передачей offset, чтобы забирать новые посты
        const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId}`;
        const response = await axios.get(url);
        
        if (response.data && response.data.ok) {
            let messages = response.data.result;
            
            messages.forEach(item => {
                // Запоминаем ID последнего обновления, чтобы не запрашивать его повторно
                if (item.update_id >= lastUpdateId) {
                    lastUpdateId = item.update_id + 1;
                }

                // Проверяем, что это пост из нашего канала
                if (item.channel_post) {
                    let p = item.channel_post;
                    let chat = p.chat;
                    
                    let isTargetChannel = chat && (
                        (chat.username && chat.username.toLowerCase() === CHANNEL_USERNAME.replace('@', '').toLowerCase()) ||
                        (chat.title && chat.title.toLowerCase().includes('gruppas'))
                    );

                    if (isTargetChannel) {
                        const newPost = {
                            id: p.message_id,
                            date: new Date(p.date * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                            text: p.text || p.caption || 'Новость без текста'
                        };

                        // Проверяем, нет ли уже такого поста в кэше, чтобы избежать дубликатов
                        if (!newsCache.some(existing => existing.id === newPost.id)) {
                            newsCache.unshift(newPost); // Добавляем новый пост в начало
                        }
                    }
                }
            });
        }

        res.json(newsCache);
    } catch (e) {
        console.error(e);
        res.json(newsCache);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер новостей запущен на порту ${PORT}`);
});
