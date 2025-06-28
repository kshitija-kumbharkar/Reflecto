/*
const express = require('express');
const path = require('path');
const ReflectoChatbot = require('./chatbot');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine to handle HTML templates
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Initialize chatbot instance
const chatbot = new ReflectoChatbot(process.env.OPENAI_API_KEY);

// Routes
app.get('/', (req, res) => {
    res.render('chat', {
        history: chatbot.getConversationHistory().slice(1), // Skip system message
        message: ""
    });
});

app.post('/', async (req, res) => {
    try {
        const userInput = req.body.user_input;
        const response = await chatbot.getResponse(userInput);
        
        res.render('chat', {
            history: chatbot.getConversationHistory().slice(1),
            message: response
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.render('chat', {
            history: chatbot.getConversationHistory().slice(1),
            message: "An error occurred while processing your request."
        });
    }
});

app.get('/refresh', (req, res) => {
    chatbot.clearHistory();
    res.redirect('/');
});

// API endpoints for integration
app.get('/api/history', (req, res) => {
    res.json({
        history: chatbot.getConversationHistory().slice(1)
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        const response = await chatbot.getResponse(message);
        res.json({
            response: response,
            history: chatbot.getConversationHistory().slice(1)
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/clear', (req, res) => {
    chatbot.clearHistory();
    res.json({ message: 'History cleared successfully' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Reflecto Chatbot server running on http://localhost:${PORT}`);
});

module.exports = app;   
*/

const express = require('express');
const path = require('path');
const session = require('express-session');
const ReflectoChatbot = require('./chatbot');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware for user isolation
app.use(session({
    secret: process.env.SESSION_SECRET || 'reflecto-chatbot-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set view engine to handle HTML templates
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Function to get or create chatbot instance for user session
function getChatbotForSession(req) {
    // Create a new chatbot instance each time
    const chatbot = new ReflectoChatbot(process.env.OPENAI_API_KEY);
    
    // Restore conversation history from session if it exists
    if (req.session.conversationHistory) {
        chatbot.conversationHistory = req.session.conversationHistory;
    }
    
    return chatbot;
}

// Function to save chatbot state to session
function saveChatbotToSession(req, chatbot) {
    req.session.conversationHistory = chatbot.getConversationHistory();
}

// Routes
app.get('/', (req, res) => {
    const chatbot = getChatbotForSession(req);
    res.render('chat', {
        history: chatbot.getConversationHistory().slice(1), // Skip system message
        message: "",
        sessionId: req.sessionID
    });
});

app.post('/', async (req, res) => {
    try {
        const chatbot = getChatbotForSession(req);
        const userInput = req.body.user_input;
        const response = await chatbot.getResponse(userInput);
        
        // Save conversation history to session
        saveChatbotToSession(req, chatbot);
        
        res.render('chat', {
            history: chatbot.getConversationHistory().slice(1),
            message: response,
            sessionId: req.sessionID
        });
    } catch (error) {
        console.error('Error processing request:', error);
        const chatbot = getChatbotForSession(req);
        res.render('chat', {
            history: chatbot.getConversationHistory().slice(1),
            message: "An error occurred while processing your request.",
            sessionId: req.sessionID
        });
    }
});

app.get('/refresh', (req, res) => {
    // Clear conversation history from session
    req.session.conversationHistory = null;
    res.redirect('/');
});

// New endpoint for creating isolated sessions
app.get('/new-session', (req, res) => {
    // Destroy current session and create new one
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

// API endpoints for integration
app.get('/api/history', (req, res) => {
    const chatbot = getChatbotForSession(req);
    res.json({
        history: chatbot.getConversationHistory().slice(1),
        sessionId: req.sessionID
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        const chatbot = getChatbotForSession(req);
        const response = await chatbot.getResponse(message);
        
        // Save conversation history to session
        saveChatbotToSession(req, chatbot);
        
        res.json({
            response: response,
            history: chatbot.getConversationHistory().slice(1),
            sessionId: req.sessionID
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/clear', (req, res) => {
    req.session.conversationHistory = null;
    res.json({ 
        message: 'History cleared successfully',
        sessionId: req.sessionID
    });
});

// New API endpoint to get session info
app.get('/api/session', (req, res) => {
    res.json({
        sessionId: req.sessionID,
        hasHistory: req.session.conversationHistory ? req.session.conversationHistory.length > 1 : false
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Reflecto Chatbot server running on http://localhost:${PORT}`);
    console.log(`📝 Each user gets an isolated session - no conversation sharing!`);
});

module.exports = app;