# Architecture

User → Claude UI  
        ↓  
Extension Sidebar  
        ↓  
Coach Engine  

Flow:
1. Capture prompt
2. Detect intent
3. Ask questions
4. Build structured intent
5. Output improved prompt + skill suggestions

Constraints:
- No Claude API integration
- DOM-based reading only
