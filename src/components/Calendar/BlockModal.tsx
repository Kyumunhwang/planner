'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimeBlock } from '@/types';
import { DEFAULT_CATEGORIES, getCategoryColor, slotToTime, timeToSlot } from '@/types';
import styles from './BlockModal.module.css';

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: Partial<TimeBlock>) => void;
  onDelete?: (id: string) => void;
  block?: TimeBlock;
  defaultStartSlot?: number;
  defaultEndSlot?: number;
}

const NEW_CATEGORY_SENTINEL = '__new__';

// Generate time options for selects
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let slot = 0; slot < 48; slot++) {
    const time = slotToTime(slot);
    options.push({ value: time, label: time });
  }
  // Add 24:00 for end time
  options.push({ value: '24:00', label: '24:00' });
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function BlockModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  block,
  defaultStartSlot,
  defaultEndSlot,
}: BlockModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isEditing = !!block;

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('수업');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [content, setContent] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [type, setType] = useState<'plan' | 'log'>('plan');

  // Custom category
  const [customCategories, setCustomCategories] = useState<{ name: string; color: string }[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6c8cff');

  // Reset form on open
  useEffect(() => {
    if (!isOpen) return;
    if (block) {
      setTitle(block.title);
      setCategory(block.category);
      setStartTime(slotToTime(block.startSlot));
      setEndTime(slotToTime(block.endSlot));
      setContent(block.content || '');
      setIsPriority(block.isPriority);
      setType(block.type);
    } else {
      setTitle('');
      setCategory('수업');
      setStartTime(
        defaultStartSlot !== undefined ? slotToTime(defaultStartSlot) : '09:00'
      );
      setEndTime(
        defaultEndSlot !== undefined ? slotToTime(defaultEndSlot) : '10:00'
      );
      setContent('');
      setIsPriority(false);
      setType('plan');
    }
    setShowNewCategory(false);
    setNewCategoryName('');
  }, [isOpen, block, defaultStartSlot, defaultEndSlot]);

  // Load custom categories from database on open
  useEffect(() => {
    if (!isOpen) return;
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.categories || []).map((c: any) => ({
            name: c.name,
            color: c.color,
          }));
          setCustomCategories(mapped);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  // Category select change
  const handleCategoryChange = useCallback((value: string) => {
    if (value === NEW_CATEGORY_SENTINEL) {
      setShowNewCategory(true);
    } else {
      setCategory(value);
      setShowNewCategory(false);
    }
  }, []);

  // Add new category and persist to database
  const handleAddCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const newCat = { name, color: newCategoryColor };
    setCustomCategories((prev) => [...prev, newCat]);
    setCategory(name);
    setShowNewCategory(false);
    setNewCategoryName('');

    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newCategoryColor }),
      });
    } catch (err) {
      console.error('Failed to save category:', err);
    }
  }, [newCategoryName, newCategoryColor]);

  // Save
  const handleSave = useCallback(() => {
    if (!title.trim()) return;

    const startSlot = timeToSlot(startTime);
    let endSlot: number;
    if (endTime === '24:00') {
      endSlot = 48;
    } else {
      endSlot = timeToSlot(endTime);
    }

    if (endSlot <= startSlot) return;

    const payload: Partial<TimeBlock> = {
      title: title.trim(),
      category,
      startSlot,
      endSlot,
      content: content.trim() || undefined,
      isPriority,
      type,
    };

    if (block) {
      payload.id = block.id;
      payload.planId = block.planId;
      payload.logId = block.logId;
    }

    onSave(payload);
    onClose();
  }, [title, category, startTime, endTime, content, isPriority, type, block, onSave, onClose]);

  // Delete
  const handleDelete = useCallback(() => {
    if (block && onDelete) {
      onDelete(block.id);
      onClose();
    }
  }, [block, onDelete, onClose]);

  if (!isOpen) return null;

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const selectedCatColor = getCategoryColor(category, customCategories);

  // Filter end-time options: must be > startTime
  const startSlotValue = timeToSlot(startTime);
  const validEndOptions = TIME_OPTIONS.filter((opt) => {
    const s = opt.value === '24:00' ? 48 : timeToSlot(opt.value);
    return s > startSlotValue;
  });

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>
            {isEditing ? '일정 수정' : '새 일정'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Form ── */}
        <div className={styles.body}>
          {/* Type toggle */}
          <div className={styles.field}>
            <label className={styles.label}>유형</label>
            <div className={styles.typeToggle}>
              <button
                className={`${styles.typeBtn} ${type === 'plan' ? styles.typeBtnActive : ''}`}
                onClick={() => setType('plan')}
                type="button"
              >
                계획
              </button>
              <button
                className={`${styles.typeBtn} ${type === 'log' ? styles.typeBtnActive : ''}`}
                onClick={() => setType('log')}
                type="button"
              >
                기록
              </button>
            </div>
          </div>

          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>제목 *</label>
            <input
              className={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              autoFocus
            />
          </div>

          {/* Category */}
          <div className={styles.field}>
            <label className={styles.label}>카테고리</label>
            <div className={styles.categoryRow}>
              <span
                className={styles.categoryDot}
                style={{ backgroundColor: selectedCatColor }}
              />
              <select
                className={styles.select}
                value={showNewCategory ? NEW_CATEGORY_SENTINEL : category}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {allCategories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
                <option value={NEW_CATEGORY_SENTINEL}>
                  + 새 카테고리 추가
                </option>
              </select>
            </div>
            {showNewCategory && (
              <div className={styles.newCategoryRow}>
                <input
                  className={styles.input}
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="카테고리 이름"
                />
                <input
                  type="color"
                  className={styles.colorPicker}
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                />
                <button
                  className={styles.addCatBtn}
                  onClick={handleAddCategory}
                  type="button"
                >
                  추가
                </button>
              </div>
            )}
          </div>

          {/* Time */}
          <div className={styles.timeRow}>
            <div className={styles.field}>
              <label className={styles.label}>시작 시간</label>
              <select
                className={styles.select}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {TIME_OPTIONS.filter((o) => o.value !== '24:00').map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.timeSeparator}>~</div>
            <div className={styles.field}>
              <label className={styles.label}>종료 시간</label>
              <select
                className={styles.select}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {validEndOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          <div className={styles.field}>
            <label className={styles.label}>내용</label>
            <textarea
              className={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상세 내용을 입력하세요 (선택)"
              rows={3}
            />
          </div>

          {/* Priority */}
          <div className={styles.field}>
            <label className={styles.toggleLabel}>
              <span>우선순위</span>
              <button
                type="button"
                role="switch"
                aria-checked={isPriority}
                className={`${styles.toggle} ${isPriority ? styles.toggleOn : ''}`}
                onClick={() => setIsPriority((v) => !v)}
              >
                <span className={styles.toggleThumb} />
              </button>
            </label>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          {isEditing && onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              type="button"
            >
              삭제
            </button>
          )}
          <div className={styles.footerRight}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              type="button"
            >
              취소
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!title.trim()}
              type="button"
            >
              {isEditing ? '수정' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
