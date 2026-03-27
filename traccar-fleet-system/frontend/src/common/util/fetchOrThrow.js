export default async (input, init) => {
  const response = await fetch(input, { credentials: 'include', ...init });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
};
