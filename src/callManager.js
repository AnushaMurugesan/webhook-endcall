import dotenv from 'dotenv';
dotenv.config();

const MAX_DURATION = parseInt(process.env.MAX_CALL_DURATION_SECONDS || '15');

// Store active calls
const activeCalls = new Map();

/**
 * Handle incoming Vapi webhook events
 */
export async function handleVapiWebhook(webhookData) {
  const message = webhookData.message;
  const call = message.call;
  const callId = call?.id;
  
  if (!callId) {
    console.log('⚠️  No callId in webhook');
    return;
  }
  
  const eventType = message.type;
  console.log(`📞 Call ${callId}: ${eventType}`);
  
  switch (eventType) {
    case 'assistant.started':
    case 'call-start':
    case 'call.started':
      await handleCallStart(call);
      break;
      
    case 'status-update':
      // Monitor call status changes
      if (call.status === 'in-progress') {
        await handleCallStart(call);
      }
      break;
      
    case 'end-of-call-report':
    case 'call.ended':
      handleCallEnd(callId);
      break;
      
    default:
      // Check if call is active and needs termination
      await checkAndEndCall(callId);
  }
}

/**
 * Start tracking a call
 */
async function handleCallStart(call) {
  const callId = call.id;
  
  // Skip if already tracking
  if (activeCalls.has(callId)) {
    return;
  }
  
  const controlUrl = call.monitor?.controlUrl;
  
  if (!controlUrl) {
    console.log(`⚠️  No controlUrl for call ${callId}`);
    return;
  }
  
  const callData = {
    callId,
    controlUrl,
    startTime: Date.now(),
    timerId: null,
    ended: false
  };
  
  // Set timer to end call after MAX_DURATION seconds
  callData.timerId = setTimeout(async () => {
    await endCall(callId, 'timeout');
  }, MAX_DURATION * 1000);
  
  activeCalls.set(callId, callData);
  
  console.log(`✅ Tracking call ${callId} (will end in ${MAX_DURATION}s)`);
  console.log(`   Control URL: ${controlUrl}`);
}

/**
 * Check if call exceeded duration and end it
 */
async function checkAndEndCall(callId) {
  const callData = activeCalls.get(callId);
  
  if (!callData || callData.ended) {
    return;
  }
  
  const elapsed = (Date.now() - callData.startTime) / 1000;
  
  if (elapsed >= MAX_DURATION) {
    await endCall(callId, 'exceeded');
  }
}

/**
 * End a call using Control URL
 */
async function endCall(callId, reason) {
  const callData = activeCalls.get(callId);
  
  if (!callData || callData.ended) {
    return;
  }
  
  callData.ended = true;
  
  // Clear timeout
  if (callData.timerId) {
    clearTimeout(callData.timerId);
  }
  
  const elapsed = ((Date.now() - callData.startTime) / 1000).toFixed(1);
  
  console.log(`⏱️  Ending call ${callId} after ${elapsed}s (${reason})`);
  
  try {
    const response = await fetch(callData.controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: 'end-call'
      })
    });
    
    if (response.ok) {
      console.log(`✅ Call ${callId} ended successfully`);
    } else {
      const text = await response.text();
      console.error(`❌ Failed to end call ${callId}:`, response.status, text);
    }
  } catch (error) {
    console.error(`❌ Error ending call ${callId}:`, error.message);
  }
  
  // Cleanup after 30 seconds
  setTimeout(() => {
    activeCalls.delete(callId);
    console.log(`🗑️  Cleaned up call ${callId}`);
  }, 30000);
}

/**
 * Handle call end event
 */
function handleCallEnd(callId) {
  const callData = activeCalls.get(callId);
  
  if (callData) {
    if (callData.timerId) {
      clearTimeout(callData.timerId);
    }
    
    const duration = ((Date.now() - callData.startTime) / 1000).toFixed(1);
    console.log(`📴 Call ${callId} ended naturally after ${duration}s`);
    
    activeCalls.delete(callId);
  }
}