'use client';

import { useState } from 'react';
import { ArrowUpIcon, SparklesIcon, CodeBracketIcon, ClockIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface APIEvent {
  type: string;
  timestamp: number;
  data: any;
  elapsedSinceLastEvent?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [apiEvents, setApiEvents] = useState<APIEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const formatElapsedTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setTotalElapsedTime(null);
    const startTime = Date.now();
    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear previous events and add initial request event
    setApiEvents([{
      type: 'request',
      timestamp: startTime,
      data: {
        model: 'gpt-4o',
        input: [{ role: 'user', content: input }],
        stream: true,
        text: { format: { type: 'text' } },
        temperature: 0.7
      }
    }]);

    setInput('');
    let assistantMessage = { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.concat(userMessage).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream available');

      let lastEventTime = startTime;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const currentTime = Date.now();
            
            switch (parsed.type) {
              case 'text':
                // Update the assistant's message with new text
                assistantMessage = {
                  ...assistantMessage,
                  content: assistantMessage.content + parsed.value
                };
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessage.id ? assistantMessage : m
                ));
                break;

              case 'event':
                // Add timing information to the event
                const eventWithTiming = {
                  type: parsed.value.type,
                  timestamp: currentTime,
                  data: parsed.value,
                  elapsedSinceLastEvent: currentTime - lastEventTime
                };
                setApiEvents(prev => [...prev, eventWithTiming]);
                lastEventTime = currentTime;

                // If this is a completion event, set the total elapsed time
                if (parsed.value.type === 'response.completed') {
                  setTotalElapsedTime(currentTime - startTime);
                }
                break;

              case 'error':
                throw new Error(parsed.value.message);

              case 'done':
                // Stream is complete
                break;
            }
          } catch (e) {
            console.error('Failed to parse stream data:', e);
            throw e;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove the assistant's message if we got an error
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-screen">
      <div className="flex h-full max-h-screen">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col max-h-screen">
          {/* Header */}
          <header className="flex-none py-4">
            <h1 className="text-3xl font-bold text-center text-gray-800">
              OpenAI Responses API Demo
            </h1>
            <p className="text-center text-gray-600 mt-2">
              Experience the power of the new Responses API with streaming
            </p>
          </header>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 space-y-6 max-h-[calc(100vh-13rem)]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex items-start gap-4 rounded-lg p-4',
                  message.role === 'assistant'
                    ? 'bg-white shadow-sm'
                    : 'bg-blue-50'
                )}
              >
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    message.role === 'assistant'
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500'
                      : 'bg-blue-600'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <SparklesIcon className="w-5 h-5 text-white" />
                  ) : (
                    <div className="text-white font-semibold">U</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="prose prose-sm">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            
            {error && (
              <div className="rounded-lg p-4 bg-red-50 text-red-700">
                Error: {error}
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex-none p-4 border-t bg-white">
            <div className="flex gap-4">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask anything..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={clsx(
                  'rounded-lg px-4 py-2 font-medium text-white',
                  'bg-gradient-to-r from-blue-500 to-blue-600',
                  'hover:from-blue-600 hover:to-blue-700',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <ArrowUpIcon className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* API Events Visualization */}
        <div className="w-96 border-l bg-gray-50 flex flex-col max-h-screen">
          <div className="sticky top-0 bg-gray-50 pb-4 z-10 flex-none">
            <div className="flex items-center justify-between gap-2 text-gray-700 mb-4">
              <div className="flex items-center gap-2">
                <CodeBracketIcon className="w-5 h-5" />
                <h2 className="font-semibold">Responses API Events</h2>
              </div>
              {totalElapsedTime && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
                  <ClockIcon className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-medium text-indigo-700">
                    Total: {formatElapsedTime(totalElapsedTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto min-h-0 p-4">
            {apiEvents.map((event, index) => (
              <div
                key={index}
                className={clsx(
                  'rounded-lg p-4 text-sm font-mono relative',
                  'animate-fade-in transition-all duration-300',
                  event.type === 'request' ? 'bg-blue-50 border border-blue-100' :
                  event.type === 'response.created' ? 'bg-purple-50 border border-purple-100' :
                  event.type === 'response.in_progress' ? 'bg-yellow-50 border border-yellow-100' :
                  event.type === 'response.output_text.delta' ? 'bg-green-50 border border-green-100' :
                  event.type === 'response.completed' ? 'bg-emerald-50 border border-emerald-100' :
                  'bg-gray-50 border border-gray-100'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={clsx(
                    'text-xs font-semibold px-2 py-1 rounded-full',
                    event.type === 'request' ? 'bg-blue-100 text-blue-700' :
                    event.type === 'response.created' ? 'bg-purple-100 text-purple-700' :
                    event.type === 'response.in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    event.type === 'response.output_text.delta' ? 'bg-green-100 text-green-700' :
                    event.type === 'response.completed' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-700'
                  )}>
                    {event.type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {event.elapsedSinceLastEvent && (
                      <span className={clsx(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        event.elapsedSinceLastEvent < 100 ? 'bg-green-100 text-green-700' :
                        event.elapsedSinceLastEvent < 500 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-700'
                      )}>
                        +{formatElapsedTime(event.elapsedSinceLastEvent)}
                      </span>
                    )}
                  </div>
                </div>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
                {index < apiEvents.length - 1 && (
                  <div className="absolute left-1/2 -bottom-4 transform -translate-x-1/2 w-px h-4 bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
