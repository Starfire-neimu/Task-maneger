/* ============================================
   TASKFLOW APPLICATION
   Modular vanilla JS architecture
   ============================================ */
const App = (() => {
  'use strict';
  
  /* ------------------------------------------
     STATE
     ------------------------------------------ */
  const STORAGE_KEY = 'taskflow_data_v1';
  const state = {
    tasks: [],
    activity: [],
    filter: 'all',
    categoryFilter: 'all',
    search: '',
    editingId: null,
    calendarDate: new Date(),
    theme: 'dark',
    settings: {
      darkMode: true,
      language: 'en',
      pushNotif: true,
      soundAlert: false
    }
  };
  
  const CATEGORIES = ['Personal','Work','School','Shopping','Health','Finance','Other'];
  const CATEGORY_ICONS = {
    Personal:'fa-user', Work:'fa-briefcase', School:'fa-graduation-cap',
    Shopping:'fa-shopping-cart', Health:'fa-heart', Finance:'fa-wallet', Other:'fa-folder'
  };
  
  /* ------------------------------------------
     UTILITIES
     ------------------------------------------ */
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const today = () => new Date().toISOString().split('T')[0];
  const isToday = d => d && d === today();
  const isThisWeek = d => {
    if (!d) return false;
    const date = new Date(d);
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  };
  const isOverdue = task => {
    if (!task.dueDate || task.status === 'completed' || task.status === 'archived') return false;
    return new Date(task.dueDate) < new Date(today());
  };
  const formatDate = d => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  };
  const escapeHtml = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  
  /* ------------------------------------------
     STORAGE
     ------------------------------------------ */
  const Storage = {
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          tasks: state.tasks,
          activity: state.activity.slice(0, 50),
          settings: state.settings,
          theme: state.theme
        }));
      } catch(e) { console.warn('Storage save failed', e); }
    },
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data) {
          state.tasks = data.tasks || [];
          state.activity = data.activity || [];
          state.settings = { ...state.settings, ...(data.settings || {}) };
          state.theme = data.theme || 'dark';
        }
      } catch(e) { console.warn('Storage load failed', e); }
    }
  };
  
  /* ------------------------------------------
     TOAST NOTIFICATIONS
     ------------------------------------------ */
  const Toast = {
    show(message, type='success') {
      const icons = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-circle', info:'fa-info-circle' };
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${escapeHtml(message)}</span>`;
      $('#toastContainer').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };
  
  /* ------------------------------------------
     TASK OPERATIONS
     ------------------------------------------ */
  const Tasks = {
    add(data) {
      const task = {
        id: uid(),
        title: data.title.trim(),
        description: data.description?.trim() || '',
        dueDate: data.dueDate || '',
        priority: data.priority || 'medium',
        category: data.category || 'Other',
        status: data.status || 'pending',
        colorLabel: data.colorLabel || '#3B82F6',
        notes: data.notes?.trim() || '',
        createdAt: Date.now(),
        completedAt: null,
        order: state.tasks.length
      };
      state.tasks.unshift(task);
      this.log('created', task.title);
      Storage.save();
      Render.all();
      Toast.show('Task created successfully');
      return task;
    },
    
    update(id, data) {
      const idx = state.tasks.findIndex(t => t.id === id);
      if (idx === -1) return;
      const task = state.tasks[idx];
      Object.assign(task, data);
      if (data.status === 'completed' && task.status !== 'completed') {
        task.completedAt = Date.now();
        this.log('completed', task.title);
      } else if (data.status && data.status !== 'completed') {
        task.completedAt = null;
      }
      Storage.save();
      Render.all();
      Toast.show('Task updated');
    },
    
    delete(id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      state.tasks = state.tasks.filter(t => t.id !== id);
      this.log('deleted', task.title);
      Storage.save();
      Render.all();
      Toast.show('Task deleted', 'warning');
    },
    
    toggleComplete(id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      const el = $(`.task-item[data-id="${id}"]`);
      if (el && task.status !== 'completed') el.classList.add('completing');
      
      if (task.status === 'completed') {
        task.status = 'pending';
        task.completedAt = null;
        this.log('reopened', task.title);
      } else {
        task.status = 'completed';
        task.completedAt = Date.now();
        this.log('completed', task.title);
      }
      Storage.save();
      setTimeout(() => Render.all(), 300);
    },
    
    duplicate(id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      const copy = { ...task, id: uid(), title: task.title + ' (copy)', createdAt: Date.now(), completedAt: null, status: 'pending' };
      state.tasks.unshift(copy);
      Storage.save();
      Render.all();
      Toast.show('Task duplicated');
    },
    
    archive(id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      task.status = 'archived';
      this.log('archived', task.title);
      Storage.save();
      Render.all();
      Toast.show('Task archived');
    },
    
    restore(id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      task.status = 'pending';
      this.log('restored', task.title);
      Storage.save();
      Render.all();
      Toast.show('Task restored');
    },
    
    log(action, title) {
      state.activity.unshift({ action, title, time: Date.now() });
      if (state.activity.length > 50) state.activity = state.activity.slice(0, 50);
    },
    
    getFiltered() {
      let list = [...state.tasks];
      const f = state.filter;
      
      if (f === 'pending') list = list.filter(t => t.status === 'pending');
      else if (f === 'completed') list = list.filter(t => t.status === 'completed');
      else if (f === 'overdue') list = list.filter(isOverdue);
      else if (f === 'high') list = list.filter(t => t.priority === 'high' && t.status !== 'completed');
      else if (f === 'today') list = list.filter(t => isToday(t.dueDate) && t.status !== 'completed');
      else if (f === 'week') list = list.filter(t => isThisWeek(t.dueDate) && t.status !== 'completed');
      else if (f === 'archived') list = list.filter(t => t.status === 'archived');
      else list = list.filter(t => t.status !== 'archived');
      
      if (state.categoryFilter !== 'all') {
        list = list.filter(t => t.category === state.categoryFilter);
      }
      if (state.search) {
        const q = state.search.toLowerCase();
        list = list.filter(t => 
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.notes||'').toLowerCase().includes(q)
        );
      }
      
      // Sort: pending first, then by priority, then by due date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      list.sort((a,b) => {
        if (a.status !== b.status) return a.status === 'completed' ? 1 : -1;
        if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        return b.createdAt - a.createdAt;
      });
      return list;
    }
  };
  
  /* ------------------------------------------
     RENDERING
     ------------------------------------------ */
  const Render = {
    all() {
      this.stats();
      this.tasks();
      this.recentTasks();
      this.quickStats();
      this.calendar();
      this.progress();
      this.widgets();
      this.charts();
      this.categories();
      this.updateTaskCount();
      Reveal.init();
    },
    
    stats() {
      const total = state.tasks.filter(t => t.status !== 'archived').length;
      const completed = state.tasks.filter(t => t.status === 'completed').length;
      const pending = state.tasks.filter(t => t.status === 'pending').length;
      const overdue = state.tasks.filter(isOverdue).length;
      
      animateCounter('[data-counter="total"]', total);
      animateCounter('[data-counter="completed"]', completed);
      animateCounter('[data-counter="pending"]', pending);
      animateCounter('[data-counter="overdue"]', overdue);
      
      const max = Math.max(total, 1);
      $('[data-progress="total"]').style.width = (total/max*100) + '%';
      $('[data-progress="completed"]').style.width = (completed/max*100) + '%';
      $('[data-progress="pending"]').style.width = (pending/max*100) + '%';
      $('[data-progress="overdue"]').style.width = (overdue/max*100) + '%';
    },
    
    tasks() {
      const list = Tasks.getFiltered();
      const container = $('#tasksList');
      if (list.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-clipboard-list"></i>
            <h3 style="margin-bottom:0.5rem;">No tasks found</h3>
            <p>Create a new task to get started!</p>
          </div>`;
        return;
      }
      container.innerHTML = list.map(t => `
        <div class="task-item ${t.status === 'completed' ? 'completed' : ''}" 
             data-id="${t.id}" 
             draggable="true"
             style="--task-color:${t.colorLabel}">
          <div class="task-checkbox" onclick="App.toggleComplete('${t.id}')">
            <i class="fas fa-check"></i>
          </div>
          <div class="task-body" onclick="App.editTask('${t.id}')">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="task-meta">
              <span class="priority-badge priority-${t.priority}">${t.priority}</span>
              <span><i class="fas ${CATEGORY_ICONS[t.category]||'fa-folder'}"></i> ${t.category}</span>
              ${t.dueDate ? `<span class="${isOverdue(t)?'style=color:var(--danger)':''}"><i class="fas fa-calendar"></i> ${formatDate(t.dueDate)}</span>` : ''}
            </div>
          </div>
          <div class="task-actions">
            ${t.status === 'archived' 
              ? `<button class="task-action-btn" onclick="event.stopPropagation();App.restore('${t.id}')" title="Restore"><i class="fas fa-undo"></i></button>`
              : `<button class="task-action-btn" onclick="event.stopPropagation();App.archive('${t.id}')" title="Archive"><i class="fas fa-archive"></i></button>`}
            <button class="task-action-btn" onclick="event.stopPropagation();App.duplicate('${t.id}')" title="Duplicate"><i class="fas fa-copy"></i></button>
            <button class="task-action-btn" onclick="event.stopPropagation();App.editTask('${t.id}')" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="task-action-btn delete" onclick="event.stopPropagation();App.confirmDelete('${t.id}')" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');
      
      // Attach drag handlers
      $$('.task-item', container).forEach(el => {
        el.addEventListener('dragstart', e => {
          el.classList.add('dragging');
          e.dataTransfer.setData('text/plain', el.dataset.id);
        });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
        el.addEventListener('dragover', e => {
          e.preventDefault();
          const dragging = $('.dragging', container);
          if (dragging && dragging !== el) {
            const rect = el.getBoundingClientRect();
            const after = (e.clientY - rect.top) > rect.height / 2;
            container.insertBefore(dragging, after ? el.nextSibling : el);
          }
        });
        el.addEventListener('drop', e => {
          e.preventDefault();
          // Reorder state
          const newOrder = $$('.task-item', container).map(el => el.dataset.id);
          state.tasks.sort((a,b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
          Storage.save();
        });
      });
    },
    
    recentTasks() {
      const recent = state.tasks
        .filter(t => t.status !== 'archived')
        .sort((a,b) => b.createdAt - a.createdAt)
        .slice(0, 5);
      const container = $('#recentTasks');
      if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:1rem"><p>No tasks yet</p></div>';
        return;
      }
      container.innerHTML = recent.map(t => `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--card-border);">
          <div style="width:8px;height:8px;border-radius:50%;background:${t.colorLabel};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${t.status==='completed'?'text-decoration:line-through;color:var(--text-muted)':''}">${escapeHtml(t.title)}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">${t.category} · ${formatDate(t.dueDate) || 'No date'}</div>
          </div>
          <span class="priority-badge priority-${t.priority}" style="font-size:0.65rem;">${t.priority}</span>
        </div>
      `).join('');
    },
    
    quickStats() {
      const total = state.tasks.filter(t => t.status !== 'archived').length;
      const completed = state.tasks.filter(t => t.status === 'completed').length;
      const rate = total ? Math.round(completed/total*100) : 0;
      const highPriority = state.tasks.filter(t => t.priority === 'high' && t.status === 'pending').length;
      const todayTasks = state.tasks.filter(t => isToday(t.dueDate) && t.status !== 'completed').length;
      
      $('#quickStats').innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--card-border);">
          <span style="color:var(--text-secondary);font-size:0.85rem;">Completion Rate</span>
          <span style="font-weight:600;">${rate}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--card-border);">
          <span style="color:var(--text-secondary);font-size:0.85rem;">High Priority</span>
          <span style="font-weight:600;color:var(--danger);">${highPriority}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--card-border);">
          <span style="color:var(--text-secondary);font-size:0.85rem;">Due Today</span>
          <span style="font-weight:600;color:var(--warning);">${todayTasks}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.75rem 0;">
          <span style="color:var(--text-secondary);font-size:0.85rem;">Total Tasks</span>
          <span style="font-weight:600;">${total}</span>
        </div>
      `;
    },
    
    categories() {
      const nav = $('#categoryNav');
      nav.innerHTML = CATEGORIES.map(cat => {
        const count = state.tasks.filter(t => t.category === cat && t.status !== 'archived').length;
        return `<a class="sidebar-link" data-category="${cat}">
          <i class="fas ${CATEGORY_ICONS[cat]}"></i> ${cat}
          <span class="count">${count}</span>
        </a>`;
      }).join('');
      
      $$('.sidebar-link[data-category]', nav).forEach(el => {
        el.addEventListener('click', () => {
          const cat = el.dataset.category;
          state.categoryFilter = cat;
          $('#categoryFilter').value = cat;
          navigateTo('tasks');
          Render.tasks();
          closeSidebar();
        });
      });
    },
    
    updateTaskCount() {
      const count = state.tasks.filter(t => t.status === 'pending').length;
      $('#taskCount').textContent = count;
    },
    
    calendar() {
      const d = state.calendarDate;
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      $('#calendarTitle').textContent = `${monthNames[month]} ${year}`;
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month+1, 0);
      const startOffset = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      const prevMonthDays = new Date(year, month, 0).getDate();
      
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      let html = dayNames.map(n => `<div class="calendar-day-name">${n}</div>`).join('');
      
      const taskDates = {};
      state.tasks.forEach(t => {
        if (t.dueDate && t.status !== 'archived') {
          taskDates[t.dueDate] = (taskDates[t.dueDate] || 0) + 1;
        }
      });
      
      const todayStr = today();
      
      // Previous month days
      for (let i = startOffset - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${prevMonthDays - i}</div>`;
      }
      // Current month
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const classes = ['calendar-day'];
        if (dateStr === todayStr) classes.push('today');
        if (taskDates[dateStr]) classes.push('has-tasks');
        html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${i}</div>`;
      }
      // Next month
      const totalCells = startOffset + daysInMonth;
      const remaining = (7 - (totalCells % 7)) % 7;
      for (let i = 1; i <= remaining; i++) {
        html += `<div class="calendar-day other-month">${i}</div>`;
      }
      
      $('#calendarGrid').innerHTML = html;
      
      $$('.calendar-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
          state.filter = 'all';
          state.search = el.dataset.date;
          navigateTo('tasks');
          $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
          Render.tasks();
        });
      });
    },
    
    progress() {
      const now = new Date();
      const todayStr = today();
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const createdToday = state.tasks.filter(t => new Date(t.createdAt).toDateString() === now.toDateString());
      const completedToday = createdToday.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === now.toDateString()).length
        + state.tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === now.toDateString() && new Date(t.createdAt).toDateString() !== now.toDateString()).length;
      const totalToday = createdToday.length || 1;
      
      const createdWeek = state.tasks.filter(t => new Date(t.createdAt) >= startOfWeek);
      const completedWeek = state.tasks.filter(t => t.completedAt && new Date(t.completedAt) >= startOfWeek).length;
      const totalWeek = createdWeek.length || 1;
      
      const createdMonth = state.tasks.filter(t => new Date(t.createdAt) >= startOfMonth);
      const completedMonth = state.tasks.filter(t => t.completedAt && new Date(t.completedAt) >= startOfMonth).length;
      const totalMonth = createdMonth.length || 1;
      
      const total = state.tasks.filter(t => t.status !== 'archived').length;
      const completed = state.tasks.filter(t => t.status === 'completed').length;
      
      const percents = {
        daily: Math.min(100, Math.round(completedToday/totalToday*100)),
        weekly: Math.min(100, Math.round(completedWeek/totalWeek*100)),
        monthly: Math.min(100, Math.round(completedMonth/totalMonth*100)),
        overall: total ? Math.round(completed/total*100) : 0
      };
      
      const circumference = 2 * Math.PI * 65; // ~408
      $$('.circular-progress').forEach(el => {
        const key = el.dataset.progress;
        const pct = percents[key];
        const offset = circumference - (pct/100 * circumference);
        el.querySelector('.fg').style.strokeDashoffset = offset;
        el.querySelector('.value').textContent = pct + '%';
      });
    },
    
    widgets() {
      // Upcoming deadlines
      const upcoming = state.tasks
        .filter(t => t.dueDate && t.status === 'pending' && new Date(t.dueDate) >= new Date(today()))
        .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);
      const deadlineEl = $('#upcomingDeadlines');
      if (upcoming.length === 0) {
        deadlineEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0;text-align:center;">No upcoming deadlines</div>';
      } else {
        deadlineEl.innerHTML = upcoming.map(t => {
          const days = Math.ceil((new Date(t.dueDate) - new Date(today())) / 86400000);
          const urgent = days <= 2;
          return `<div class="deadline-item">
            <div>
              <div class="deadline-title">${escapeHtml(t.title)}</div>
              <div class="deadline-date ${urgent?'urgent':''}">${formatDate(t.dueDate)} · ${days === 0 ? 'Today' : days + ' days'}</div>
            </div>
            <span class="priority-badge priority-${t.priority}">${t.priority}</span>
          </div>`;
        }).join('');
      }
      
      // Recent activity
      const actEl = $('#recentActivity');
      if (state.activity.length === 0) {
        actEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0;text-align:center;">No recent activity</div>';
      } else {
        actEl.innerHTML = state.activity.slice(0, 5).map(a => {
          const icons = { created:'fa-plus', completed:'fa-check', deleted:'fa-trash', archived:'fa-archive', restored:'fa-undo', reopened:'fa-redo' };
          const ago = timeAgo(a.time);
          return `<div class="activity-item">
            <div class="activity-icon"><i class="fas ${icons[a.action]||'fa-circle'}"></i></div>
            <div class="activity-text">
              <div><strong>${a.action}</strong>: ${escapeHtml(a.title)}</div>
              <div class="activity-time">${ago}</div>
            </div>
          </div>`;
        }).join('');
      }
      
      // Daily goal
      const completedToday = state.tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;
      const goal = 5;
      const pct = Math.min(100, Math.round(completedToday/goal*100));
      $('#dailyGoalBar').style.width = pct + '%';
      $('#dailyGoalText').textContent = `${completedToday} / ${goal} completed`;
      $('#dailyGoalPercent').textContent = pct + '%';
    },
    
    charts() {
      // Weekly tasks completed
      const weekData = Array(7).fill(0);
      const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const now = new Date();
      state.tasks.forEach(t => {
        if (t.completedAt) {
          const d = new Date(t.completedAt);
          if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)) {
            weekData[d.getDay()]++;
          }
        }
      });
      
      // Category distribution
      const catData = {};
      CATEGORIES.forEach(c => catData[c] = 0);
      state.tasks.filter(t => t.status !== 'archived').forEach(t => {
        catData[t.category] = (catData[t.category] || 0) + 1;
      });
      
      // Priority distribution
      const prioData = { low: 0, medium: 0, high: 0 };
      state.tasks.filter(t => t.status !== 'archived').forEach(t => {
        prioData[t.priority]++;
      });
      
      // Trend (last 7 days)
      const trendData = Array(7).fill(0);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toDateString();
        trendData[6-i] = state.tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === ds).length;
      }
      
      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#9CA3AF', font: { family: 'Poppins' } } }
        },
        scales: {
          x: { ticks: { color: '#9CA3AF', font: { family: 'Poppins' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9CA3AF', font: { family: 'Poppins' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      };
      
      // Destroy existing
      Object.values(Charts.instances).forEach(c => c && c.destroy());
      
      const gradient1 = createGradient('chartWeekly', '#3B82F6', '#8B5CF6');
      Charts.instances.weekly = new Chart($('#chartWeekly'), {
        type: 'bar',
        data: {
          labels: dayLabels,
          datasets: [{
            label: 'Completed',
            data: weekData,
            backgroundColor: gradient1,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: chartOptions
      });
      
      Charts.instances.category = new Chart($('#chartCategory'), {
        type: 'doughnut',
        data: {
          labels: CATEGORIES,
          datasets: [{
            data: CATEGORIES.map(c => catData[c]),
            backgroundColor: ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF', font: { family: 'Poppins', size: 11 }, padding: 15 } } }
        }
      });
      
      const gradient2 = createGradient('chartTrend', '#3B82F6', '#8B5CF6');
      Charts.instances.trend = new Chart($('#chartTrend'), {
        type: 'line',
        data: {
          labels: dayLabels,
          datasets: [{
            label: 'Productivity',
            data: trendData,
            borderColor: '#3B82F6',
            backgroundColor: gradient2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#8B5CF6',
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: chartOptions
      });
      
      Charts.instances.priority = new Chart($('#chartPriority'), {
        type: 'pie',
        data: {
          labels: ['Low','Medium','High'],
          datasets: [{
            data: [prioData.low, prioData.medium, prioData.high],
            backgroundColor: ['#10B981','#F59E0B','#EF4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF', font: { family: 'Poppins' }, padding: 15 } } }
        }
      });
    }
  };
  
  /* ------------------------------------------
     CHARTS HELPER
     ------------------------------------------ */
  const Charts = { instances: {} };
  function createGradient(canvasId, color1, color2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return color1;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, color1 + 'CC');
    g.addColorStop(1, color2 + '11');
    return g;
  }
  
  /* ------------------------------------------
     COUNTER ANIMATION
     ------------------------------------------ */
  function animateCounter(selector, target) {
    const el = $(selector);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }
  
  /* ------------------------------------------
     TIME AGO
     ------------------------------------------ */
  function timeAgo(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }
  
  /* ------------------------------------------
     NAVIGATION
     ------------------------------------------ */
  function navigateTo(section) {
    $$('.section').forEach(s => s.classList.remove('active'));
    $$('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    $(`#section-${section}`).classList.add('active');
    $(`.sidebar-link[data-section="${section}"]`)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (section === 'charts') setTimeout(() => Render.charts(), 100);
  }
  
  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('active');
  }
  
  /* ------------------------------------------
     THEME
     ------------------------------------------ */
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    $('#themeToggle i').className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    $('#darkModeSetting').checked = theme === 'dark';
    Storage.save();
    // Re-render charts with new colors
    if ($('#section-charts').classList.contains('active')) Render.charts();
  }
  
  /* ------------------------------------------
     POMODORO TIMER
     ------------------------------------------ */
  const Pomodoro = {
    duration: 25 * 60,
    remaining: 25 * 60,
    running: false,
    interval: null,
    mode: 'focus', // 'focus' or 'break'
    
    start() {
      if (this.running) {
        this.pause();
        return;
      }
      this.running = true;
      $('#pomoStart').innerHTML = '<i class="fas fa-pause"></i> Pause';
      this.interval = setInterval(() => {
        this.remaining--;
        this.updateDisplay();
        if (this.remaining <= 0) {
          this.complete();
        }
      }, 1000);
    },
    
    pause() {
      this.running = false;
      clearInterval(this.interval);
      $('#pomoStart').innerHTML = '<i class="fas fa-play"></i> Start';
    },
    
    reset() {
      this.pause();
      this.duration = this.mode === 'focus' ? 25 * 60 : 5 * 60;
      this.remaining = this.duration;
      this.updateDisplay();
    },
    
    skip() {
      this.mode = this.mode === 'focus' ? 'break' : 'focus';
      this.duration = this.mode === 'focus' ? 25 * 60 : 5 * 60;
      this.remaining = this.duration;
      this.pause();
      this.updateDisplay();
    },
    
    complete() {
      this.pause();
      Toast.show(this.mode === 'focus' ? 'Focus session complete! Take a break.' : 'Break over! Ready to focus?', 'success');
      this.mode = this.mode === 'focus' ? 'break' : 'focus';
      this.duration = this.mode === 'focus' ? 25 * 60 : 5 * 60;
      this.remaining = this.duration;
      this.updateDisplay();
    },
    
    updateDisplay() {
      const min = Math.floor(this.remaining / 60);
      const sec = this.remaining % 60;
      $('#pomoTime').textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
      $('#pomoStatus').textContent = this.mode === 'focus' ? 'Focus Time' : 'Break Time';
    }
  };
  
  /* ------------------------------------------
     QUOTES
     ------------------------------------------ */
  const Quotes = {
    list: [
      { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
      { text: "It is not enough to be busy. The question is: what are we busy about?", author: "Henry David Thoreau" },
      { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
      { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
      { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
      { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
      { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
      { text: "Productivity is never an accident. It is always the result of commitment to excellence.", author: "Paul J. Meyer" },
      { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
      { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" }
    ],
    current: 0,
    show() {
      const q = this.list[this.current];
      $('#quoteText').textContent = `"${q.text}"`;
      $('#quoteAuthor').textContent = `— ${q.author}`;
    },
    next() {
      this.current = (this.current + 1) % this.list.length;
      this.show();
    }
  };
  
  /* ------------------------------------------
     SCROLL REVEAL
     ------------------------------------------ */
  const Reveal = {
    observer: null,
    init() {
      if (!this.observer) {
        this.observer = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (e.isIntersecting) {
              e.target.classList.add('visible');
              this.observer.unobserve(e.target);
            }
          });
        }, { threshold: 0.1 });
      }
      $$('.reveal:not(.visible)').forEach(el => this.observer.observe(el));
    }
  };
  
  /* ------------------------------------------
     RIPPLE EFFECT
     ------------------------------------------ */
  function addRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
  
  /* ------------------------------------------
     DATA EXPORT/IMPORT
     ------------------------------------------ */
  function exportData() {
    const data = JSON.stringify({ tasks: state.tasks, activity: state.activity, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Data exported successfully');
  }
  
  function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.tasks && Array.isArray(data.tasks)) {
          state.tasks = data.tasks;
          if (data.activity) state.activity = data.activity;
          Storage.save();
          Render.all();
          Toast.show('Data imported successfully');
        } else {
          Toast.show('Invalid file format', 'error');
        }
      } catch(err) {
        Toast.show('Failed to import data', 'error');
      }
    };
    reader.readAsText(file);
  }
  
  /* ------------------------------------------
     CONFIRM DIALOG
     ------------------------------------------ */
  let confirmCallback = null;
  function showConfirm(title, message, callback) {
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    confirmCallback = callback;
    $('#confirmModal').classList.add('active');
  }
  function closeConfirm() {
    $('#confirmModal').classList.remove('active');
    confirmCallback = null;
  }
  
  /* ------------------------------------------
     SEED DATA
     ------------------------------------------ */
  function seedIfEmpty() {
    if (state.tasks.length > 0) return;
    const now = Date.now();
    const dayMs = 86400000;
    const seeds = [
      { title: 'Finish project proposal', description: 'Complete Q3 project outline', dueDate: new Date(now + dayMs).toISOString().split('T')[0], priority: 'high', category: 'Work', colorLabel: '#3B82F6' },
      { title: 'Weekly grocery shopping', description: 'Buy vegetables, fruits, and dairy', dueDate: today(), priority: 'medium', category: 'Shopping', colorLabel: '#10B981' },
      { title: 'Morning workout routine', description: '30 min cardio + strength training', dueDate: today(), priority: 'medium', category: 'Health', colorLabel: '#EF4444' },
      { title: 'Read 30 pages of book', description: 'Continue reading Atomic Habits', dueDate: new Date(now + 2*dayMs).toISOString().split('T')[0], priority: 'low', category: 'Personal', colorLabel: '#8B5CF6' },
      { title: 'Pay electricity bill', description: 'Due by end of month', dueDate: new Date(now + 5*dayMs).toISOString().split('T')[0], priority: 'high', category: 'Finance', colorLabel: '#F59E0B' },
      { title: 'Study for exam', description: 'Chapter 5-7 review', dueDate: new Date(now + 3*dayMs).toISOString().split('T')[0], priority: 'high', category: 'School', colorLabel: '#06B6D4' }
    ];
    seeds.forEach(s => {
      state.tasks.push({
        id: uid(),
        title: s.title,
        description: s.description,
        dueDate: s.dueDate,
        priority: s.priority,
        category: s.category,
        status: 'pending',
        colorLabel: s.colorLabel,
        notes: '',
        createdAt: now - Math.random() * dayMs * 3,
        completedAt: null,
        order: 0
      });
    });
    // Mark one as completed for demo
    state.tasks[0].status = 'completed';
    state.tasks[0].completedAt = now - dayMs;
    Storage.save();
  }
  
  /* ------------------------------------------
     INIT
     ------------------------------------------ */
  function init() {
    Storage.load();
    seedIfEmpty();
    applyTheme(state.theme);
    
    // Navigation
    $$('.sidebar-link[data-section]').forEach(link => {
      link.addEventListener('click', () => {
        navigateTo(link.dataset.section);
        closeSidebar();
      });
    });
    
    // Hamburger
    $('#hamburger').addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
      $('#sidebarOverlay').classList.toggle('active');
    });
    $('#sidebarOverlay').addEventListener('click', closeSidebar);
    
    // Theme toggle
    $('#themeToggle').addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
    $('#darkModeSetting').addEventListener('change', e => {
      applyTheme(e.target.checked ? 'dark' : 'light');
    });
    
    // Search
    $('#globalSearch').addEventListener('input', e => {
      state.search = e.target.value;
      if (!$('#section-tasks').classList.contains('active')) navigateTo('tasks');
      Render.tasks();
    });
    
    // Filters
    $$('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.filter = chip.dataset.filter;
        Render.tasks();
      });
    });
    $('#categoryFilter').addEventListener('change', e => {
      state.categoryFilter = e.target.value;
      Render.tasks();
    });
    
    // Color options
    $$('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        $$('.color-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    
    // Settings
    $('#languageSetting').addEventListener('change', e => {
      state.settings.language = e.target.value;
      Storage.save();
      Toast.show('Language preference saved');
    });
    $('#pushNotif').addEventListener('change', e => {
      state.settings.pushNotif = e.target.checked;
      Storage.save();
    });
    $('#soundAlert').addEventListener('change', e => {
      state.settings.soundAlert = e.target.checked;
      Storage.save();
    });
    $('#importFile').addEventListener('change', e => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });
    
    // Pomodoro
    $('#pomoStart').addEventListener('click', () => Pomodoro.start());
    $('#pomoReset').addEventListener('click', () => Pomodoro.reset());
    $('#pomoSkip').addEventListener('click', () => Pomodoro.skip());
    
    // Confirm button
    $('#confirmBtn').addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirm();
    });
    
    // Ripple on buttons
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn, .nav-btn, .fab, .task-action-btn');
      if (btn) addRipple(e);
    });
    
    // Greeting based on time
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#greeting').textContent = `${greeting}! Let's get productive today.`;
    
    // Initial render
    Render.all();
    Quotes.show();
    
    // Hide loader
    setTimeout(() => $('#loader').classList.add('hidden'), 600);
  }
  
  /* ------------------------------------------
     PUBLIC API
     ------------------------------------------ */
  return {
    init,
    openTaskModal(id = null) {
      state.editingId = id;
      const form = $('#taskForm');
      form.reset();
      $$('.color-option').forEach(o => o.classList.remove('selected'));
      $('.color-option[data-color="#3B82F6"]').classList.add('selected');
      
      if (id) {
        const t = state.tasks.find(x => x.id === id);
        if (!t) return;
        $('#taskModalTitle').textContent = 'Edit Task';
        $('#taskId').value = t.id;
        $('#taskTitle').value = t.title;
        $('#taskDesc').value = t.description;
        $('#taskDue').value = t.dueDate;
        $('#taskPriority').value = t.priority;
        $('#taskCategory').value = t.category;
        $('#taskStatus').value = t.status;
        $('#taskNotes').value = t.notes || '';
        const colorOpt = $(`.color-option[data-color="${t.colorLabel}"]`);
        if (colorOpt) {
          $$('.color-option').forEach(o => o.classList.remove('selected'));
          colorOpt.classList.add('selected');
        }
      } else {
        $('#taskModalTitle').textContent = 'New Task';
        $('#taskId').value = '';
        $('#taskDue').value = today();
      }
      $('#taskModal').classList.add('active');
    },
    closeTaskModal() {
      $('#taskModal').classList.remove('active');
      state.editingId = null;
    },
    saveTask() {
      const data = {
        title: $('#taskTitle').value,
        description: $('#taskDesc').value,
        dueDate: $('#taskDue').value,
        priority: $('#taskPriority').value,
        category: $('#taskCategory').value,
        status: $('#taskStatus').value,
        colorLabel: $('.color-option.selected')?.dataset.color || '#3B82F6',
        notes: $('#taskNotes').value
      };
      if (!data.title.trim()) {
        Toast.show('Title is required', 'error');
        return;
      }
      if (state.editingId) {
        Tasks.update(state.editingId, data);
      } else {
        Tasks.add(data);
      }
      this.closeTaskModal();
    },
    editTask(id) { this.openTaskModal(id); },
    toggleComplete: (id) => Tasks.toggleComplete(id),
    duplicate: (id) => Tasks.duplicate(id),
    archive: (id) => Tasks.archive(id),
    restore: (id) => Tasks.restore(id),
    confirmDelete(id) {
      showConfirm('Delete Task', 'This task will be permanently deleted. Continue?', () => Tasks.delete(id));
    },
    clearCompleted() {
      showConfirm('Clear Completed', 'All completed tasks will be permanently removed. Continue?', () => {
        state.tasks = state.tasks.filter(t => t.status !== 'completed');
        Storage.save();
        Render.all();
        Toast.show('Completed tasks cleared');
      });
    },
    resetAll() {
      showConfirm('Reset All Data', 'This will delete ALL tasks and settings. This cannot be undone!', () => {
        localStorage.removeItem(STORAGE_KEY);
        state.tasks = [];
        state.activity = [];
        Storage.save();
        Render.all();
        Toast.show('All data has been reset');
      });
    },
    exportData,
    closeConfirm,
    calendar: {
      prev() { state.calendarDate.setMonth(state.calendarDate.getMonth() - 1); Render.calendar(); },
      next() { state.calendarDate.setMonth(state.calendarDate.getMonth() + 1); Render.calendar(); },
      goToday() { state.calendarDate = new Date(); Render.calendar(); }
    },
    quotes: Quotes
  };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
