import { IncidentAnalysis } from "../types";

const WEBHOOK_URL = "https://hook.eu2.make.com/pqh9l7wmjwq8vc5w3cwv8n76pg9kulhg";

export const sendToWebhook = async (
    data: IncidentAnalysis, 
    originalMessage: string,
    userDetails: { name: string; room: string }
): Promise<boolean> => {
  try {
    // Split name into First Name and Last Name for better CRM integration
    const nameParts = userDetails.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const payload = {
        ...data,
        original_message: originalMessage,
        tenant_name: userDetails.name, // Full name matches Firestore
        first_name: firstName,         // Specific field for Make
        last_name: lastName,           // Specific field for Make
        room: userDetails.room,        // Specific field for Make
        timestamp: new Date().toISOString(),
        source: "IncidenBot Web App"
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error sending to webhook:", error);
    throw error;
  }
};