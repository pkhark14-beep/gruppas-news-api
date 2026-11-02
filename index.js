const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL || '@gruppasnews';

let newsCache = [];
let lastFetchTime = 0;
const CACHE_TTL = 3 * 60 * 1000; // Кэш на 3 минуты

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    const now = Date.now();
    if (newsCache.length > 0 && (now - lastFetchTime < CACHE_TTL)) {
        return res.json(newsCache);
    }

    try {
        // Очищаем вебхуки на всякий случай, чтобы getUpdates работал стабильно
        await axios.get(`https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=true`).catch(() => {});

        // Запрос к Telegram Bot API
        const url = `https://api.telegram.org/bot${TOKEN}/getUpdates`;
        const response = await axios.get(url);
        
        if (response.data && response.data.ok) {
            let messages = response.data.result;
            
            // Фильтруем посты именно из твоего канала
            let posts = messages
                .filter(item => {
                    if (!item.channel_post) return false;
                    let chat = item.channel_post.chat;
                    // Проверяем по юзернейму или названию канала
                    return chat && (
                        (chat.username && chat.username.toLowerCase() === CHANNEL_USERNAME.replace('@', '').toLowerCase()) ||
                        (chat.title && chat.title.toLowerCase().includes('gruppas'))
                    );
                })
                .map(item => {
                    let p = item.channel_post;
                    return {
                        id: p.message_id,
                        date: new Date(p.date * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
                        text: p.text || p.caption || 'Новость без текста'
                    };
                });

            // Если бот видит посты, обновляем кэш
            if (posts.length > 0) {
                newsCache = posts.reverse();
                lastFetchTime = now;
            }
        }

        res.json(newsCache);
    } catch (e) {
        console.error(e);
        // Если что-то пойдет не так, отдадим старый кэш, чтобы сайт не падал
        res.json(newsCache);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер новостей запущен на порту ${PORT}`);
});