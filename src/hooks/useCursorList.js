// src/hooks/useCursorList.js
import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

/**
 * Custom hook for cursor-based pagination with the new Go backend
 * @param {string} path - API endpoint path
 * @param {Object} params - Query parameters
 * @param {Object} options - Additional options
 * @returns {Object} - Pagination state and methods
 */
export const useCursorList = (path, params = {}, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [afterId, setAfterId] = useState(null);

  const fetchData = useCallback(async (reset = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const queryParams = {
        ...params,
        limit: options.limit || 50,
        ...(reset ? {} : { afterId })
      };

      const response = await api.get(path, { params: queryParams });
      const newData = response.data.data || response.data;
      const pagination = response.data.pagination || {};

      if (reset) {
        setData(newData);
      } else {
        setData(prev => [...prev, ...newData]);
      }

      setAfterId(pagination.afterId || null);
      setHasMore(pagination.hasMore || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path, params, options.limit, afterId, loading]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchData(false);
    }
  }, [hasMore, loading, fetchData]);

  const refresh = useCallback(() => {
    setAfterId(null);
    setHasMore(true);
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    refresh();
  }, [path, JSON.stringify(params)]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    setData
  };
};

export default useCursorList;
