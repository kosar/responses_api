# OpenAI Responses API Demo

A real-time streaming demo application built with Next.js that showcases OpenAI's Responses API capabilities, including web search integration and event-driven response handling.

## Overview

This application demonstrates the capabilities of OpenAI's Responses API, a new offering that provides enhanced control over response generation and real-time event handling. The demo features a dual-panel interface that separates API events from response content, making it ideal for developers who want to understand the internals of OpenAI's streaming responses.

## Key Features

- **Real-time Event Streaming**: Visualize OpenAI's response generation process through a detailed event panel
- **Web Search Integration**: Enable real-time web search capabilities during response generation
- **Dual Panel Interface**:
  - Left Panel: Generated response content
  - Right Panel: Detailed API event stream including timestamps and event types
- **Modern Stack**: Built with Next.js 14, React, and Tailwind CSS

## Technical Implementation

### Event Streaming Architecture

The application implements server-sent events (SSE) to stream responses in real-time:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    // Handle incoming events from OpenAI
    for await (const event of response) {
      // Process and emit events to the client
    }
  }
});
```

### Event Types

The application handles several types of events:

- `response.created`: Initial response creation
- `response.in_progress`: Active response generation
- `response.output_text.delta`: Incremental text updates
- `web_search.started`: Web search initiation with timestamp
- `web_search.completed`: Search completion with timestamp and result count
- `response.output_item.done`: Completion of an output item
- `response.completed`: Final completion of the response

### Web Search Feature

The application integrates OpenAI's web search capability, allowing the model to access real-time information during response generation. To test the web search:

1. Enable the "Enable web search" checkbox
2. Ask a question about recent events, e.g., "Who won the last Super Bowl?"
3. Observe the web search events in the right panel:
   - Search initiation (`web_search.started`)
   - Search completion (`web_search.completed`)

The right panel will show timestamps for each event, allowing you to track the duration of web searches and response generation.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/responses-api-demo.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Configuration

The application uses the following OpenAI configuration:

- Model: gpt-4o (Note: The exact model name may change as OpenAI updates their API. Check the [OpenAI documentation](https://platform.openai.com/docs) for the latest model that supports web search)
- Temperature: 0.7
- Stream: Enabled
- Tools: Web search (optional)

## Development Notes

This project was created to explore the capabilities of OpenAI's Responses API, which provides more granular control over response generation compared to the traditional Chat Completions API. The implementation showcases:

- Event-driven architecture for handling streaming responses
- Real-time state management for concurrent events
- Integration with OpenAI's web search capability
- TypeScript types for response events and API interactions

## Requirements

- Node.js 18.x or higher
- OpenAI API key with access to GPT-4 models
- Modern web browser with SSE support

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [OpenAI Node.js SDK](https://github.com/openai/openai-node) - OpenAI API client
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - AI utilities

## License

MIT
