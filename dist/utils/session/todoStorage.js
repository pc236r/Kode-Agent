import { setSessionState, getSessionState } from './sessionState';
import { readAgentData, writeAgentData, resolveAgentId, } from '@utils/agent/storage';
const TODO_STORAGE_KEY = 'todos';
const TODO_CONFIG_KEY = 'todoConfig';
const TODO_CACHE_KEY = 'todoCache';
const DEFAULT_CONFIG = {
    maxTodos: 100,
    autoArchiveCompleted: false,
    sortBy: 'status',
    sortOrder: 'desc',
};
let todoCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000;
function invalidateCache() {
    todoCache = null;
    cacheTimestamp = 0;
}
function updateMetrics(operation, cacheHit = false) {
    const sessionState = getSessionState();
    const metrics = sessionState.todoMetrics || {
        totalOperations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastOperation: 0,
    };
    metrics.totalOperations++;
    metrics.lastOperation = Date.now();
    if (cacheHit) {
        metrics.cacheHits++;
    }
    else {
        metrics.cacheMisses++;
    }
    setSessionState({
        ...sessionState,
        todoMetrics: metrics,
    });
}
export function getTodoMetrics() {
    const sessionState = getSessionState();
    return (sessionState.todoMetrics || {
        totalOperations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastOperation: 0,
    });
}
export function getTodos(agentId) {
    const resolvedAgentId = resolveAgentId(agentId);
    const now = Date.now();
    if (agentId) {
        updateMetrics('getTodos', false);
        const agentTodos = readAgentData(resolvedAgentId) || [];
        const agentCacheKey = `todoCache_${resolvedAgentId}`;
        return agentTodos.map(todo => ({
            ...todo,
            activeForm: todo.activeForm || todo.content,
        }));
    }
    if (todoCache && now - cacheTimestamp < CACHE_TTL) {
        updateMetrics('getTodos', true);
        return todoCache.map(todo => ({
            ...todo,
            activeForm: todo.activeForm || todo.content,
        }));
    }
    updateMetrics('getTodos', false);
    const sessionState = getSessionState();
    const todos = sessionState[TODO_STORAGE_KEY] || [];
    todoCache = [...todos].map((todo) => ({
        ...todo,
        activeForm: todo.activeForm || todo.content,
    }));
    cacheTimestamp = now;
    return todoCache;
}
export function setTodos(todos, agentId) {
    const resolvedAgentId = resolveAgentId(agentId);
    const config = getTodoConfig();
    const existingTodos = getTodos(agentId);
    if (agentId) {
        if (todos.length > config.maxTodos) {
            throw new Error(`Todo limit exceeded. Maximum ${config.maxTodos} todos allowed.`);
        }
        let processedTodos = todos;
        if (config.autoArchiveCompleted) {
            processedTodos = todos.filter(todo => todo.status !== 'completed');
        }
        const updatedTodos = processedTodos.map(todo => {
            const existingTodo = existingTodos.find(existing => existing.id === todo.id);
            return {
                ...todo,
                activeForm: todo.activeForm || todo.content,
                updatedAt: Date.now(),
                createdAt: todo.createdAt || Date.now(),
                previousStatus: existingTodo?.status !== todo.status
                    ? existingTodo?.status
                    : todo.previousStatus,
            };
        });
        writeAgentData(resolvedAgentId, updatedTodos);
        updateMetrics('setTodos');
        return;
    }
    if (todos.length > config.maxTodos) {
        throw new Error(`Todo limit exceeded. Maximum ${config.maxTodos} todos allowed.`);
    }
    let processedTodos = todos;
    if (config.autoArchiveCompleted) {
        processedTodos = todos.filter(todo => todo.status !== 'completed');
    }
    const updatedTodos = processedTodos.map(todo => {
        const existingTodo = existingTodos.find(existing => existing.id === todo.id);
        return {
            ...todo,
            activeForm: todo.activeForm || todo.content,
            updatedAt: Date.now(),
            createdAt: todo.createdAt || Date.now(),
            previousStatus: existingTodo?.status !== todo.status
                ? existingTodo?.status
                : todo.previousStatus,
        };
    });
    setSessionState({
        ...getSessionState(),
        [TODO_STORAGE_KEY]: updatedTodos,
    });
    invalidateCache();
    updateMetrics('setTodos');
}
export function getTodoConfig() {
    const sessionState = getSessionState();
    return { ...DEFAULT_CONFIG, ...(sessionState[TODO_CONFIG_KEY] || {}) };
}
export function setTodoConfig(config) {
    const currentConfig = getTodoConfig();
    const newConfig = { ...currentConfig, ...config };
    setSessionState({
        ...getSessionState(),
        [TODO_CONFIG_KEY]: newConfig,
    });
    if (config.sortBy || config.sortOrder) {
        const todos = getTodos();
        setTodos(todos);
    }
}
export function addTodo(todo) {
    const todos = getTodos();
    if (todos.some(existing => existing.id === todo.id)) {
        throw new Error(`Todo with ID '${todo.id}' already exists`);
    }
    const newTodo = {
        ...todo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    const updatedTodos = [...todos, newTodo];
    setTodos(updatedTodos);
    updateMetrics('addTodo');
    return updatedTodos;
}
export function updateTodo(id, updates) {
    const todos = getTodos();
    const existingTodo = todos.find(todo => todo.id === id);
    if (!existingTodo) {
        throw new Error(`Todo with ID '${id}' not found`);
    }
    const updatedTodos = todos.map(todo => todo.id === id ? { ...todo, ...updates, updatedAt: Date.now() } : todo);
    setTodos(updatedTodos);
    updateMetrics('updateTodo');
    return updatedTodos;
}
export function deleteTodo(id) {
    const todos = getTodos();
    const todoExists = todos.some(todo => todo.id === id);
    if (!todoExists) {
        throw new Error(`Todo with ID '${id}' not found`);
    }
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    updateMetrics('deleteTodo');
    return updatedTodos;
}
export function clearTodos() {
    setTodos([]);
    updateMetrics('clearTodos');
}
export function getTodoById(id) {
    const todos = getTodos();
    updateMetrics('getTodoById');
    return todos.find(todo => todo.id === id);
}
export function getTodosByStatus(status) {
    const todos = getTodos();
    updateMetrics('getTodosByStatus');
    return todos.filter(todo => todo.status === status);
}
export function getTodosByPriority(priority) {
    const todos = getTodos();
    updateMetrics('getTodosByPriority');
    return todos.filter(todo => todo.priority === priority);
}
export function queryTodos(query) {
    const todos = getTodos();
    updateMetrics('queryTodos');
    return todos.filter(todo => {
        if (query.status && !query.status.includes(todo.status)) {
            return false;
        }
        if (query.priority && !query.priority.includes(todo.priority)) {
            return false;
        }
        if (query.contentMatch &&
            !todo.content.toLowerCase().includes(query.contentMatch.toLowerCase())) {
            return false;
        }
        if (query.tags && todo.tags) {
            const hasMatchingTag = query.tags.some(tag => todo.tags.includes(tag));
            if (!hasMatchingTag)
                return false;
        }
        if (query.dateRange) {
            const todoDate = new Date(todo.createdAt || 0);
            if (query.dateRange.from && todoDate < query.dateRange.from)
                return false;
            if (query.dateRange.to && todoDate > query.dateRange.to)
                return false;
        }
        return true;
    });
}
export function getTodoStatistics() {
    const todos = getTodos();
    const metrics = getTodoMetrics();
    return {
        total: todos.length,
        byStatus: {
            pending: todos.filter(t => t.status === 'pending').length,
            in_progress: todos.filter(t => t.status === 'in_progress').length,
            completed: todos.filter(t => t.status === 'completed').length,
        },
        byPriority: {
            high: todos.filter(t => t.priority === 'high').length,
            medium: todos.filter(t => t.priority === 'medium').length,
            low: todos.filter(t => t.priority === 'low').length,
        },
        metrics,
        cacheEfficiency: metrics.totalOperations > 0
            ? Math.round((metrics.cacheHits / metrics.totalOperations) * 100)
            : 0,
    };
}
export function optimizeTodoStorage() {
    invalidateCache();
    const todos = getTodos();
    const validTodos = todos.filter(todo => todo.id &&
        todo.content &&
        todo.activeForm &&
        ['pending', 'in_progress', 'completed'].includes(todo.status) &&
        ['high', 'medium', 'low'].includes(todo.priority));
    if (validTodos.length !== todos.length) {
        setTodos(validTodos);
    }
    updateMetrics('optimizeTodoStorage');
}
//# sourceMappingURL=todoStorage.js.map