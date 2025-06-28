const OpenAI = require('openai');
const fs = require('fs').promises;
require('dotenv').config();

class ReflectoChatbot {
    constructor(apiKey = null) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY;
        
        if (!this.apiKey) {
            throw new Error("OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it directly.");
        }
        
        // Initialize OpenAI client
        this.client = new OpenAI({
            apiKey: this.apiKey
        });
        
        // Initialize conversation history
        this.conversationHistory = [
            { role: "system", content: "You are Reflecto, a helpful, friendly, and thoughtful assistant who helps users reflect on their thoughts and questions." }
        ];
        
        // Model to use (free tier compatible)
        this.model = "gpt-4o-mini";
    }
    
    addMessage(role, content) {
        this.conversationHistory.push({ role, content });
        
        // Keep conversation history manageable (last 20 messages)
        if (this.conversationHistory.length > 21) { // 20 + system message
            this.conversationHistory = [
                this.conversationHistory[0],
                ...this.conversationHistory.slice(-20)
            ];
        }
    }
    
    async getResponse(userMessage) {
        try {
            // Add user message to history
            this.addMessage("user", userMessage);
            
            // Make API call using OpenAI client
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: this.conversationHistory,
                max_tokens: 500,
                temperature: 0.7,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            });
            
            // Extract assistant's response
            const assistantMessage = response.choices[0].message.content.trim();
            
            // Add assistant response to history
            this.addMessage("assistant", assistantMessage);
            
            return assistantMessage;
            
        } catch (error) {
            // Handle different types of errors
            const errorMessage = error.message || error.toString();
            
            if (errorMessage.toLowerCase().includes('rate_limit')) {
                return "Rate limit exceeded. Please wait a moment before trying again.";
            } else if (errorMessage.toLowerCase().includes('authentication')) {
                return "Authentication failed. Please check your API key.";
            } else if (errorMessage.toLowerCase().includes('invalid')) {
                return `Invalid request: ${errorMessage}`;
            } else {
                console.error('OpenAI API Error:', error);
                return `An error occurred: ${errorMessage}`;
            }
        }
    }
    
    clearHistory() {
        this.conversationHistory = [this.conversationHistory[0]]; // Keep only system message
    }
    
    getConversationHistory() {
        return this.conversationHistory;
    }
    
    async saveConversation(filename) {
        try {
            await fs.writeFile(filename, JSON.stringify(this.conversationHistory, null, 2));
            console.log(`Conversation saved to ${filename}`);
        } catch (error) {
            console.error(`Error saving conversation: ${error.message}`);
        }
    }

    async loadConversation(filename) {
        try {
            const data = await fs.readFile(filename, 'utf8');
            this.conversationHistory = JSON.parse(data);        
            console.log(`Conversation loaded from ${filename}`);
        } catch (error) {
            console.error(`Error loading conversation: ${error.message}`);
        }
    }
}

module.exports = ReflectoChatbot;