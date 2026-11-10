export class WindowManager extends EventTarget {
    constructor(workspace, taskbar, sound = () => {}) {
        super();
        this.mobile = false;
        this.sound = sound;
        this.taskbar = taskbar;
        this.workspace = workspace;
        this.windows = new Map();
        this.sequence = 0;
        this.observer = new ResizeObserver(() => {
            for (const state of this.windows.values()) this.place(state);
        });
        this.observer.observe(workspace);
    }

    place(state) {
        const width = this.workspace.clientWidth;
        const height = this.workspace.clientHeight;
        if (this.mobile || state.maximized) {
            Object.assign(state.element.style, { left: '0px', top: '0px', width: `${width}px`, height: `${height}px` });
            return;
        }
        state.element.style.width = `${Math.min(state.width, width)}px`;
        state.element.style.height = `${Math.min(state.height, height)}px`;
        const maxX = Math.max(0, this.workspace.clientWidth - state.element.offsetWidth);
        const maxY = Math.max(0, this.workspace.clientHeight - state.element.offsetHeight);
        state.x = Math.max(0, Math.min(state.x, maxX));
        state.y = Math.max(0, Math.min(state.y, maxY));
        state.element.style.left = `${state.x}px`;
        state.element.style.top = `${state.y}px`;
    }

    focus(id, keyboard = false) {
        const state = this.windows.get(id);
        if (!state) return;
        if (state.minimized) this.sound('restore');
        state.element.hidden = false;
        state.minimized = false;
        this.place(state);
        this.windows.delete(id);
        this.windows.set(id, state);
        let layer = 1;
        for (const entry of this.windows.values()) {
            entry.element.style.zIndex = layer++;
            entry.element.classList.toggle('is-focused', entry === state);
            entry.task.setAttribute('aria-pressed', String(entry === state));
        }
        if (keyboard) state.element.focus({ preventScroll: true });
        this.dispatchEvent(new Event('focus'));
    }

    open(app) {
        const id = `zomb-window-${++this.sequence}`;
        const element = document.createElement('section');
        element.className = 'zomb-window';
        element.tabIndex = -1;
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-labelledby', `${id}-title`);
        const header = document.createElement('div');
        header.className = 'zomb-window-header';
        header.tabIndex = 0;
        header.setAttribute('aria-label', `${app.title}: drag or use arrow keys to move; Shift plus arrow keys to resize`);
        const title = document.createElement('span');
        title.id = `${id}-title`;
        title.textContent = app.title;
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.setAttribute('aria-label', `Close ${app.title}`);
        const minimize = document.createElement('button');
        minimize.type = 'button';
        minimize.textContent = '−';
        minimize.setAttribute('aria-label', `Minimize ${app.title}`);
        const maximize = document.createElement('button');
        maximize.type = 'button';
        maximize.textContent = '□';
        maximize.setAttribute('aria-label', `Maximize ${app.title}`);
        const controls = document.createElement('span');
        controls.className = 'zomb-window-controls';
        controls.append(minimize, maximize, close);
        header.append(title, controls);
        const content = document.createElement('div');
        content.className = 'zomb-window-content';
        element.append(header, content);
        const state = { element, title: app.title, width: app.width || 380, height: app.height || 280, minWidth: app.minWidth || 260, minHeight: app.minHeight || 140, maximized: false, minimized: false, x: 24 + this.windows.size * 28, y: 24 + this.windows.size * 28, returnFocus: document.activeElement };
        const task = document.createElement('button');
        task.type = 'button';
        task.textContent = `${app.title} [${this.sequence}]`;
        task.addEventListener('click', () => this.focus(id, true));
        state.task = task;
        this.taskbar.append(task);
        this.windows.set(id, state);
        this.workspace.append(element);
        minimize.addEventListener('click', () => {
            this.sound('minimize');
            state.minimized = true;
            element.hidden = true;
            element.classList.remove('is-focused');
            task.setAttribute('aria-pressed', 'false');
            const next = [...this.windows.keys()].reverse().find(key => !this.windows.get(key).minimized);
            if (next) this.focus(next, true);
            else task.focus();
            this.dispatchEvent(new Event('change'));
        });
        maximize.addEventListener('click', () => {
            state.maximized = !state.maximized;
            this.sound(state.maximized ? 'maximize' : 'restore');
            element.classList.toggle('is-maximized', state.maximized);
            maximize.textContent = state.maximized ? '❐' : '□';
            maximize.setAttribute('aria-label', `${state.maximized ? 'Restore' : 'Maximize'} ${app.title}`);
            this.place(state);
        });
        for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${edge}`;
            handle.setAttribute('aria-hidden', 'true');
            element.append(handle);
            let resize = null;
            handle.addEventListener('pointerdown', event => {
                if (this.mobile || event.button !== 0 || state.maximized) return;
                event.preventDefault();
                resize = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
                    left: state.x, top: state.y, width: element.offsetWidth, height: element.offsetHeight };
                handle.setPointerCapture(event.pointerId);
            });
            handle.addEventListener('pointermove', event => {
                if (!resize || resize.pointer !== event.pointerId) return;
                const dx = event.clientX - resize.x, dy = event.clientY - resize.y;
                const right = resize.left + resize.width, bottom = resize.top + resize.height;
                const minW = Math.min(state.minWidth, this.workspace.clientWidth), minH = Math.min(state.minHeight, this.workspace.clientHeight);
                if (edge.includes('w')) {
                    state.x = Math.max(0, Math.min(resize.left + dx, right - minW));
                    state.width = right - state.x;
                }
                if (edge.includes('n')) {
                    state.y = Math.max(0, Math.min(resize.top + dy, bottom - minH));
                    state.height = bottom - state.y;
                }
                if (edge.includes('e')) state.width = Math.max(minW, Math.min(resize.width + dx, this.workspace.clientWidth - state.x));
                if (edge.includes('s')) state.height = Math.max(minH, Math.min(resize.height + dy, this.workspace.clientHeight - state.y));
                this.place(state);
            });
            for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(name, () => { resize = null; });
        }
        try {
            state.dispose = app.mount(content);
        } catch (error) {
            this.close(id);
            this.sound('error');
            throw error;
        }
        element.addEventListener('pointerdown', () => this.focus(id));
        element.addEventListener('focusin', () => this.focus(id));
        close.addEventListener('click', () => this.close(id));
        let drag = null;
        header.addEventListener('pointerdown', event => {
            if (this.mobile || state.maximized || event.target.closest('button') || event.button !== 0) return;
            event.preventDefault();
            header.focus({ preventScroll: true });
            drag = { pointer: event.pointerId, x: event.clientX - state.x, y: event.clientY - state.y };
            header.setPointerCapture(event.pointerId);
        });
        header.addEventListener('pointermove', event => {
            if (!drag || event.pointerId !== drag.pointer) return;
            state.x = event.clientX - drag.x;
            state.y = event.clientY - drag.y;
            this.place(state);
        });
        const endDrag = () => { drag = null; };
        header.addEventListener('pointerup', endDrag);
        header.addEventListener('pointercancel', endDrag);
        header.addEventListener('lostpointercapture', endDrag);
        header.addEventListener('keydown', event => {
            if (this.mobile || event.target !== header || state.maximized) return;
            const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            if (event.shiftKey) {
                state.width = Math.max(Math.min(state.minWidth, this.workspace.clientWidth), Math.min(state.element.offsetWidth + direction[0] * 10, this.workspace.clientWidth - state.x));
                state.height = Math.max(Math.min(state.minHeight, this.workspace.clientHeight), Math.min(state.element.offsetHeight + direction[1] * 10, this.workspace.clientHeight - state.y));
            } else {
                state.x += direction[0] * 10;
                state.y += direction[1] * 10;
            }
            this.place(state);
        });
        this.place(state);
        this.focus(id, true);
        this.dispatchEvent(new Event('change'));
        this.sound('open');
        return id;
    }

    close(id) {
        const state = this.windows.get(id);
        if (!state) return;
        this.sound('close');
        const hadFocus = state.element.contains(document.activeElement);
        this.windows.delete(id);
        state.element.remove();
        state.task.remove();
        try { state.dispose?.(); } finally {
            const next = [...this.windows.keys()].reverse().find(key => !this.windows.get(key).minimized);
            if (next) this.focus(next, hadFocus);
            else if (hadFocus && state.returnFocus?.isConnected && !state.returnFocus.closest('[hidden]')) state.returnFocus.focus({ preventScroll: true });
            this.dispatchEvent(new Event('change'));
        }
    }
}
