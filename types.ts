export enum IncidentCategory {
  Mantenimiento = "Mantenimiento",
  Limpieza = "Limpieza",
  Internet = "Internet",
  Administracion = "Administración",
  Emergencia = "Emergencia"
}

export enum Sentiment {
  Positivo = "Positivo",
  Neutro = "Neutro",
  Enfadado = "Enfadado"
}

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'canceled';

export interface IncidentAnalysis {
  category: IncidentCategory;
  urgency_level: number;
  sentiment: Sentiment;
  action_summary: string;
  suggested_reply: string;
}

export interface IncidentRecord extends IncidentAnalysis {
  id: string;
  // Campos solicitados para el modelo de datos
  tenantName: string;
  room: string;
  description: string; // El texto original del input
  status: IncidentStatus;
  source: string; // ej. "tenant_portal", "whatsapp"
  coliving: string; // ej. "Bali Coliving"
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisState {
  data: IncidentAnalysis | null;
  loading: boolean;
  error: string | null;
}