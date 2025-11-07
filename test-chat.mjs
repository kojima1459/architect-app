import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
    }),
  ],
});

// Test conversation creation
try {
  console.log('Testing conversation creation...');
  const result = await client.conversation.create.mutate();
  console.log('Conversation created:', result);
} catch (error) {
  console.error('Error creating conversation:', error);
}
