import { OpenAI } from 'openai';
import { StreamingTextResponse } from 'ai';

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

interface Message {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Create a response using the Responses API
  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: messages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content
    })),
    stream: true,
    text: {
      format: {
        type: 'text'
      }
    },
    temperature: 0.7
  });

  // Create a ReadableStream to handle the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper function to emit an event
      const emitEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let currentMessage = '';
        let lastEventType = '';

        for await (const event of response) {
          if (!event || !event.type) continue;

          // Track event sequence for debugging
          lastEventType = event.type;

          switch (event.type) {
            case 'response.created':
            case 'response.in_progress':
            case 'response.output_item.added':
            case 'response.content_part.added':
              // Pass through metadata events
              emitEvent({ type: 'event', value: event });
              break;

            case 'response.output_text.delta':
              if (event.delta) {
                currentMessage += event.delta;
                // Send the text delta
                emitEvent({ type: 'text', value: event.delta });
              }
              break;

            case 'response.output_text.done':
              // Text content is finalized
              emitEvent({ 
                type: 'event', 
                value: {
                  ...event,
                  finalText: currentMessage
                }
              });
              break;

            case 'response.output_item.done':
            case 'response.content_part.done':
              // Pass through completion events
              emitEvent({ type: 'event', value: event });
              break;

            case 'response.completed':
              // Final completion event
              emitEvent({ type: 'event', value: event });
              emitEvent({ type: 'done' });
              controller.close();
              return;

            case 'response.failed':
              throw new Error(event.response?.error?.message || 'Response failed');

            case 'response.incomplete':
              emitEvent({ 
                type: 'error', 
                value: {
                  message: 'Response incomplete',
                  details: event.response?.incomplete_details
                }
              });
              controller.close();
              return;
          }
        }

        // Ensure proper stream termination if we didn't get a completion event
        if (lastEventType !== 'response.completed') {
          emitEvent({ type: 'event', value: { type: 'response.completed' }});
          emitEvent({ type: 'done' });
        }
        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        // Emit error event before closing
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        emitEvent({
          type: 'error',
          value: { message: errorMessage }
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 