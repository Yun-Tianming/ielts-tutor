import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface ChatLogProps {
    messages: ChatMessage[];
}

export const ChatLog: React.FC<ChatLogProps> = ({ messages }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="h-full overflow-y-auto px-4 py-4 space-y-4 bg-white scrollbar-hide">
            {messages.length === 0 && (
                <div className="text-center text-slate-400 text-sm mt-10">
                    <p>Conversation history will appear here.</p>
                </div>
            )}
            {messages.map((msg, index) => (
                <div 
                    key={index} 
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                    <div 
                        className={`
                            max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                            ${msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-sm shadow-md shadow-blue-200' 
                                : 'bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200'}
                            ${msg.isPartial ? 'opacity-70 animate-pulse' : ''}
                        `}
                    >
                        {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {msg.role === 'user' ? 'You' : 'Examiner'}
                    </span>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
