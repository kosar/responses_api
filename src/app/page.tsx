'use client';

import { useState } from 'react';
import { ArrowUpIcon, SparklesIcon, CodeBracketIcon, ClockIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';

interface APIEvent {
  type: string;
  timestamp: number;
  data: any;
  elapsedSinceLastEvent?: number;
  isExpanded?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export default function Home() {
  const [apiEvents, setApiEvents] = useState<APIEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState<number | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [webSearchResults, setWebSearchResults] = useState<WebSearchResult[]>([]);

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
    setWebSearchResults([]);
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
        temperature: 0.7,
        tools: enableWebSearch ? [{ type: 'web_search_preview' }] : []
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
          })),
          enableWebSearch
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

                // Store web search results when they arrive
                if (parsed.value.type === 'web_search.results' && parsed.value.results) {
                  setWebSearchResults(parsed.value.results);
                }

                setApiEvents(prev => [...prev, eventWithTiming]);
                lastEventTime = currentTime;

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

  const toggleEventExpansion = (index: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const renderEventContent = (event: APIEvent, index: number) => {
    const isExpanded = expandedEvents.has(index);
    
    if (event.type === 'web_search.results' && event.data.results) {
      return (
        <div className="space-y-2">
          <div className="font-medium text-xs text-gray-700 flex items-center justify-between">
            <span>Search Results ({event.data.results.length})</span>
            <button 
              onClick={() => toggleEventExpansion(index)}
              className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </button>
          </div>
          <div className={clsx(
            'space-y-2 overflow-hidden transition-all duration-300',
            isExpanded ? 'max-h-96' : 'max-h-20'
          )}>
            {event.data.results.map((result: WebSearchResult, idx: number) => (
              <div key={idx} className={clsx(
                'text-xs rounded-md p-2 bg-white/50 backdrop-blur-sm',
                'hover:bg-white/80 transition-colors duration-200',
                !isExpanded && idx > 1 && 'hidden'
              )}>
                <a 
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium block"
                >
                  {result.title}
                </a>
                <p className="text-gray-600 text-xs mt-1 line-clamp-2">{result.snippet}</p>
              </div>
            ))}
            {!isExpanded && event.data.results.length > 2 && (
              <div className="text-xs text-gray-500 italic">
                + {event.data.results.length - 2} more results
              </div>
            )}
          </div>
        </div>
      );
    }

    const content = JSON.stringify(event.data, null, 2);
    const isLongContent = content.length > 200;

    return (
      <div>
        {isLongContent && (
          <div className="flex justify-end mb-1">
            <button 
              onClick={() => toggleEventExpansion(index)}
              className="text-gray-600 hover:text-gray-800 text-xs font-medium"
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </button>
          </div>
        )}
        <pre className={clsx(
          'text-xs overflow-x-auto bg-white/50 rounded-md p-2',
          'transition-all duration-300',
          !isExpanded && isLongContent && 'max-h-24'
        )}>
          {content}
        </pre>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto bg-gradient-to-br from-gray-50 to-gray-100 fixed inset-0">
      <div className="flex h-full">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col h-full">
          {/* Header */}
          <header className="flex-none py-2 bg-white/80 backdrop-blur-sm border-b">
            <h1 className="text-xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              OpenAI Responses API Demo
            </h1>
            <p className="text-center text-gray-600 mt-0.5 text-sm">
              Experience the power of the new Responses API with streaming
            </p>
          </header>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 space-y-3 py-2 min-h-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex items-start gap-3 rounded-lg p-3 animate-fade-in transition-all duration-300',
                  message.role === 'assistant'
                    ? 'bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md'
                    : 'bg-blue-50/80 backdrop-blur-sm'
                )}
              >
                <div
                  className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center shadow-sm',
                    message.role === 'assistant'
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <SparklesIcon className="w-4 h-4 text-white" />
                  ) : (
                    <div className="text-white font-semibold text-sm">U</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="prose prose-sm">
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          />
                        ),
                      }}
                    >
                      {message.content || (isLoading && message.role === 'assistant' && 'Thinking...')}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {error && (
              <div className="rounded-lg p-3 bg-red-50/80 backdrop-blur-sm text-red-700 animate-fade-in text-sm">
                Error: {error}
              </div>
            )}
          </div>

          {/* Input Form - Now sticky to bottom */}
          <form onSubmit={handleSubmit} className="flex-none p-2 border-t bg-white/80 backdrop-blur-sm space-y-2 sticky bottom-0 left-0 right-0">
            <div className="flex items-center gap-2 justify-end">
              <input
                type="checkbox"
                id="enableWebSearch"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="enableWebSearch" className="text-sm text-gray-700 flex items-center gap-2">
                Enable web search
                {enableWebSearch && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full">
                    Active
                  </span>
                )}
              </label>
            </div>
            <div className="flex gap-3">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask anything..."
                disabled={isLoading}
                className={clsx(
                  'flex-1 rounded-lg border px-3 py-1.5',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'bg-white/50 backdrop-blur-sm',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'placeholder-gray-400'
                )}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={clsx(
                  'rounded-lg px-3 py-1.5 font-medium text-white',
                  'bg-gradient-to-r from-blue-500 to-blue-600',
                  'hover:from-blue-600 hover:to-blue-700',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'shadow-sm hover:shadow transition-all duration-200',
                  'relative overflow-hidden'
                )}
              >
                <ArrowUpIcon className={clsx(
                  'w-5 h-5 transition-transform duration-200',
                  isLoading ? 'animate-bounce' : 'transform hover:-translate-y-0.5'
                )} />
              </button>
            </div>
          </form>
        </div>

        {/* API Events Panel */}
        <div className="w-96 border-l bg-gray-50/80 backdrop-blur-sm flex flex-col h-full">
          <div className="flex-none border-b bg-white/80 backdrop-blur-sm px-3 py-2 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg shadow-sm">
                  <CodeBracketIcon className="w-4 h-4 text-gray-700" />
                </div>
                <h2 className="font-medium text-sm text-gray-900">API Events</h2>
              </div>
              {totalElapsedTime && (
                <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-full shadow-sm">
                  <ClockIcon className="w-3 h-3 text-indigo-500" />
                  <span className="text-xs font-medium text-indigo-700">
                    Total: {formatElapsedTime(totalElapsedTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {apiEvents.map((event, index) => (
              <div
                key={index}
                className={clsx(
                  'rounded-lg p-3 text-sm font-mono relative',
                  'animate-fade-in transition-all duration-300',
                  'hover:shadow-md',
                  'border backdrop-blur-sm',
                  event.type === 'request' ? 'bg-blue-50/80 border-blue-100' :
                  event.type === 'response.created' ? 'bg-purple-50/80 border-purple-100' :
                  event.type === 'response.in_progress' ? 'bg-yellow-50/80 border-yellow-100' :
                  event.type === 'response.output_text.delta' ? 'bg-green-50/80 border-green-100' :
                  event.type === 'response.completed' ? 'bg-emerald-50/80 border-emerald-100' :
                  event.type === 'web_search.started' ? 'bg-indigo-50/80 border-indigo-100' :
                  event.type === 'web_search.results' ? 'bg-indigo-50/80 border-indigo-100' :
                  event.type === 'web_search.completed' ? 'bg-indigo-50/80 border-indigo-100' :
                  'bg-gray-50/80 border-gray-100'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={clsx(
                    'text-xs font-medium px-2 py-1 rounded-full shadow-sm',
                    'transition-colors duration-200',
                    event.type === 'request' ? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700' :
                    event.type === 'response.created' ? 'bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700' :
                    event.type === 'response.in_progress' ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-700' :
                    event.type === 'response.output_text.delta' ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700' :
                    event.type === 'response.completed' ? 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700' :
                    event.type === 'web_search.started' ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700' :
                    event.type === 'web_search.results' ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700' :
                    event.type === 'web_search.completed' ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700' :
                    'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700'
                  )}>
                    {event.type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {event.elapsedSinceLastEvent && (
                      <span className={clsx(
                        'text-xs font-medium px-2 py-0.5 rounded-full shadow-sm',
                        'transition-colors duration-200',
                        event.elapsedSinceLastEvent < 100 ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700' :
                        event.elapsedSinceLastEvent < 500 ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-700' :
                        'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700'
                      )}>
                        +{formatElapsedTime(event.elapsedSinceLastEvent)}
                      </span>
                    )}
                  </div>
                </div>
                {renderEventContent(event, index)}
                {index < apiEvents.length - 1 && (
                  <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 w-px h-2 bg-gradient-to-b from-gray-200 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
