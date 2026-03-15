export type ExamMode = 'warm_up' | 'part_1' | 'part_2' | 'part_3' | 'full_mock' | 'casual_chat';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    isPartial?: boolean;
    timestamp?: number;
}

export interface SessionRecord {
    mode: ExamMode;
    startTime: number;
    endTime?: number;
    messages: ChatMessage[];
    audioBlobs: Blob[];
}


export interface LiveConfig {
    model: string;
    systemInstruction?: string;
}

export interface AudioDeviceConfig {
    sampleRate: number;
}

export interface CasualChatMemory {
    lastUpdated: number;
    summary: string;
    recentMessages: ChatMessage[];
}
