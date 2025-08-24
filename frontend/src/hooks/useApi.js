// Simple stub implementation to prevent import errors
export const useApi = () => {
  return {
    apiService: {
      getHealth: async () => ({ status: 'healthy' })
    }
  };
};

export default useApi;