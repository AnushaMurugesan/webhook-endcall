import express from 'express';
import dotenv from 'dotenv';
import { handleVapiWebhook } from './callManager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(express.json());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Vapi Call Timer',
    maxDuration: `${process.env.MAX_CALL_DURATION_SECONDS}s`
  });
});

// Vapi Webhook Endpoint
app.post('/vapi/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received:', req.body.message?.type);
    
    await handleVapiWebhook(req.body);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint for Insomnia
app.post('/test/end-call', async (req, res) => {
  const { callId, controlUrl } = req.body;
  
  if (!controlUrl) {
    return res.status(400).json({ error: 'controlUrl required' });
  }
  
  try {
    const response = await fetch(controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'end-call' })
    });
    
    const data = await response.text();
    res.json({ success: true, callId, response: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook URL: http://localhost:${PORT}/vapi/webhook`);
  console.log(`⏱️  Max call duration: ${process.env.MAX_CALL_DURATION_SECONDS}s`);
});