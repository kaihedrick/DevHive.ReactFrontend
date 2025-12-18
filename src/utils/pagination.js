// pagination.js
// Utility for handling cursor-based pagination

import { useState } from 'react';
import { api } from '../lib/api';

/**
 * Creates a paginated API call function with cursor support
 * @param {string} basePath - The API endpoint path
 * @param {Object} defaultParams - Default parameters to include in all requests
 * @returns {Function} - Function that accepts pagination params and returns paginated data
 */
export const createPaginatedFetcher = (basePath, defaultParams = {}) => {
  return async (params = {}) => {
    const queryParams = {
      ...defaultParams,
      ...params,
      limit: params.limit || 50
    };

    try {
      const response = await api.get(basePath, { params: queryParams });

      return {
        data: response.data,
        hasMore: response.data.length === queryParams.limit,
        nextCursor: response.data.length > 0 ? response.data[response.data.length - 1].id : null
      };
    } catch (error) {
      console.error(`Error fetching paginated data from ${basePath}:`, error.message);
      throw error;
    }
  };
};

/**
 * Hook for managing cursor-based pagination state
 * @param {Function} fetcher - The paginated fetcher function
 * @param {Object} initialParams - Initial parameters
 * @returns {Object} - Pagination state and functions
 */
export const useCursorPagination = (fetcher, initialParams = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const loadMore = async (additionalParams = {}) => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const params = {
        ...initialParams,
        ...additionalParams,
        afterId: data.length > 0 ? data[data.length - 1].id : undefined
      };

      const result = await fetcher(params);

      setData(prev => [...prev, ...result.data]);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData([]);
    setHasMore(true);
    setError(null);
  };

  return {
    data,
    loading,
    hasMore,
    error,
    loadMore,
    reset
  };
};

// Pre-configured fetchers for common endpoints
export const fetchMessagesPaginated = createPaginatedFetcher('/messages');
export const fetchTasksPaginated = createPaginatedFetcher('/projects/{projectId}/tasks');
