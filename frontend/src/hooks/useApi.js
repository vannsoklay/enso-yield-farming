import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api'

/**
 * Custom hook for API interactions with caching and error handling
 * @returns {Object} API service and utilities
 */
const useApi = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  /**
   * Execute API call with loading and error handling
   * @param {Function} apiCall - API function to execute
   * @param {Object} options - Execution options
   * @returns {Promise} API response
   */
  const execute = useCallback(async (apiCall, options = {}) => {
    const { 
      showLoading = true, 
      throwError = true,
      timeout = 30000 
    } = options

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }, timeout)

    try {
      const result = await apiCall()
      clearTimeout(timeoutId)
      
      if (showLoading) {
        setLoading(false)
      }
      
      return result
    } catch (err) {
      clearTimeout(timeoutId)
      
      // Don't update state if component is unmounted or request was aborted
      if (err.name === 'AbortError') {
        return null
      }

      const errorMessage = err.message || 'An unexpected error occurred'
      setError(errorMessage)
      
      if (showLoading) {
        setLoading(false)
      }

      if (throwError) {
        throw err
      }

      return null
    }
  }, [])

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Cancel current request
   */
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setLoading(false)
  }, [])

  return {
    apiService: api,
    loading,
    error,
    execute,
    clearError,
    cancelRequest
  }
}

/**
 * Custom hook for managing API data with caching
 * @param {Function} apiCall - API function to call
 * @param {any} dependencies - Dependencies for re-fetching
 * @param {Object} options - Hook options
 * @returns {Object} Data state and utilities
 */
export const useApiData = (apiCall, dependencies = [], options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  
  const { 
    immediate = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    retryOnError = true,
    retryCount = 3,
    retryDelay = 1000
  } = options

  const retryCountRef = useRef(0)
  const { execute } = useApi()

  const fetchData = useCallback(async (force = false) => {
    // Check cache validity
    if (!force && data && lastFetch && (Date.now() - lastFetch < cacheTime)) {
      return data
    }

    try {
      const result = await execute(apiCall, { showLoading: false })
      setData(result)
      setError(null)
      setLastFetch(Date.now())
      retryCountRef.current = 0
      return result
    } catch (err) {
      setError(err.message)
      
      // Retry logic
      if (retryOnError && retryCountRef.current < retryCount) {
        retryCountRef.current++
        setTimeout(() => fetchData(force), retryDelay * retryCountRef.current)
      }
      
      throw err
    }
  }, [apiCall, data, lastFetch, cacheTime, execute, retryOnError, retryCount, retryDelay])

  // Fetch data on mount or dependencies change
  useEffect(() => {
    if (immediate) {
      setLoading(true)
      fetchData()
        .finally(() => setLoading(false))
    }
  }, [immediate, ...dependencies])

  const refetch = useCallback((force = true) => {
    setLoading(true)
    return fetchData(force)
      .finally(() => setLoading(false))
  }, [fetchData])

  const clearData = useCallback(() => {
    setData(null)
    setError(null)
    setLastFetch(null)
  }, [])

  return {
    data,
    loading,
    error,
    refetch,
    clearData,
    isStale: lastFetch ? (Date.now() - lastFetch > cacheTime) : true
  }
}

/**
 * Custom hook for handling form submissions with API calls
 * @param {Function} submitFunction - Function to call on submit
 * @param {Object} options - Hook options
 * @returns {Object} Form submission state and handler
 */
export const useApiSubmit = (submitFunction, options = {}) => {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  
  const {
    onSuccess,
    onError,
    resetOnSuccess = true,
    resetDelay = 2000
  } = options

  const { execute } = useApi()

  const submit = useCallback(async (data) => {
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const result = await execute(() => submitFunction(data), { 
        showLoading: false 
      })
      
      setSubmitSuccess(true)
      
      if (onSuccess) {
        onSuccess(result)
      }

      // Reset success state after delay
      if (resetOnSuccess) {
        setTimeout(() => {
          setSubmitSuccess(false)
        }, resetDelay)
      }

      return result
    } catch (err) {
      setSubmitError(err.message)
      
      if (onError) {
        onError(err)
      }
      
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [submitFunction, execute, onSuccess, onError, resetOnSuccess, resetDelay])

  const clearSubmitError = useCallback(() => {
    setSubmitError(null)
  }, [])

  const reset = useCallback(() => {
    setSubmitting(false)
    setSubmitError(null)
    setSubmitSuccess(false)
  }, [])

  return {
    submit,
    submitting,
    submitError,
    submitSuccess,
    clearSubmitError,
    reset
  }
}

/**
 * Custom hook for infinite loading/pagination
 * @param {Function} apiCall - API function that accepts pagination params
 * @param {Object} options - Hook options
 * @returns {Object} Pagination state and utilities
 */
export const useApiPagination = (apiCall, options = {}) => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  
  const {
    limit = 20,
    resetOnDepsChange = true
  } = options

  const { execute } = useApi()

  const loadData = useCallback(async (pageNum = 0, reset = false) => {
    const isInitial = pageNum === 0
    const isLoadingMore = pageNum > 0

    if (isInitial) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    setError(null)

    try {
      const result = await execute(() => apiCall({
        limit,
        offset: pageNum * limit
      }), { showLoading: false })

      const newItems = result.data?.items || result.data || []
      const total = result.data?.total
      
      if (reset || isInitial) {
        setItems(newItems)
      } else {
        setItems(prev => [...prev, ...newItems])
      }

      // Check if there are more items
      if (total !== undefined) {
        setHasMore((pageNum + 1) * limit < total)
      } else {
        setHasMore(newItems.length === limit)
      }

      setPage(pageNum)
      
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [apiCall, limit, execute])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      return loadData(page + 1)
    }
  }, [loadData, page, loadingMore, hasMore])

  const refresh = useCallback(() => {
    return loadData(0, true)
  }, [loadData])

  const reset = useCallback(() => {
    setItems([])
    setPage(0)
    setHasMore(true)
    setError(null)
  }, [])

  // Load initial data
  useEffect(() => {
    loadData(0, true)
  }, [])

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    page,
    loadMore,
    refresh,
    reset
  }
}

export default useApi