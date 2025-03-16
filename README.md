# OpenAI Responses API Demo

A modern web application showcasing the capabilities of OpenAI's new Responses API. This demo includes features like:

- Multiple parallel responses generation
- Real-time streaming of responses
- Beautiful, responsive UI with Tailwind CSS
- Modern React components with Next.js

## Features

- 🚀 **Multiple Responses**: Generate multiple responses in parallel for the same prompt
- ⚡ **Real-time Streaming**: See responses appear in real-time as they're generated
- 🎨 **Modern UI**: Clean and responsive design using Tailwind CSS
- 🔒 **Environment Variables**: Secure API key handling
- 📱 **Mobile-First**: Fully responsive design that works on all devices

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Usage and Costs

This demo uses the GPT-4 Turbo model with the following configuration:
- Model: gpt-4-turbo-preview
- Multiple responses: Optional (2 responses when enabled)
- Temperature: 0.7
- Streaming: Enabled

Approximate costs per request:
- Single response: ~$0.01-0.03 per request
- Multiple responses: ~$0.02-0.06 per request (2x the single response cost)

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `DEBUG_MODE`: Enable debug mode (optional, default: false)

## Tech Stack

- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

## License

MIT
