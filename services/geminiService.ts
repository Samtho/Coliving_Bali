import { GoogleGenAI, Type, Schema } from "@google/genai";
import { IncidentAnalysis, IncidentCategory, Sentiment } from "../types";

const apiKey = process.env.API_KEY;

// Define the schema strictly to match the user's requirements
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: [
        "Mantenimiento",
        "Limpieza",
        "Internet",
        "Administración",
        "Emergencia"
      ],
      description: "Clasifica la incidencia en una de las categorías permitidas."
    },
    urgency_level: {
      type: Type.INTEGER,
      description: "Nivel de urgencia del 1 al 5. 5 es acción inmediata.",
    },
    sentiment: {
      type: Type.STRING,
      enum: ["Positivo", "Neutro", "Enfadado"],
      description: "Sentimiento detectado en el mensaje."
    },
    action_summary: {
      type: Type.STRING,
      description: "Resumen operativo breve (máximo 5-7 palabras) en ESPAÑOL."
    },
    suggested_reply: {
      type: Type.STRING,
      description: "Borrador de respuesta amable y empático dirigido al inquilino."
    }
  },
  required: ["category", "urgency_level", "sentiment", "action_summary", "suggested_reply"]
};

export const analyzeIncident = async (inputText: string): Promise<IncidentAnalysis> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    Eres el "IncidenBot", un gestor de incidencias experto para un Coliving en Bali. 
    Gestionamos 50 habitaciones. Los inquilinos pueden escribir mensajes vagos, urgentes o enfadados.
    
    Analiza el texto de entrada y genera los campos requeridos en formato JSON estricto.
    
    CRITERIOS DE URGENCIA:
    1: Puede esperar semanas.
    5: Requiere acción inmediata (ahora mismo).
    
    CRITERIOS DE CATEGORÍA:
    - Mantenimiento (Cosas rotas, fontanería, electricidad).
    - Limpieza (Suciedad, basura, sábanas).
    - Internet (Wifi lento, sin conexión).
    - Administración (Pagos, dudas generales, ruido).
    - Emergencia (Fuego, inundación grave, seguridad física).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: inputText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for consistent classification
      },
    });

    if (!response.text) {
      throw new Error("No response received from Gemini.");
    }

    const data = JSON.parse(response.text) as IncidentAnalysis;
    return data;

  } catch (error) {
    console.error("Error analyzing incident:", error);
    throw error;
  }
};