/**
 * Computes deadline countdown status and display metadata for accreditation events.
 * If the accreditation is 100% complied, status will be 'completed' with emerald styling
 * instead of 'overdue'.
 * 
 * @param {string | Date | null} deadline
 * @param {boolean | number | object} [isCompletedOrPercent=false] - boolean if completed, numeric percentage, or event object
 * @returns {{
 *   hasDeadline: boolean,
 *   daysLeft: number | null,
 *   status: 'completed' | 'overdue' | 'due-today' | 'urgent' | 'upcoming' | 'normal' | 'none',
 *   label: string,
 *   shortLabel: string,
 *   formattedDate: string,
 *   inputDateValue: string,
 *   badgeClasses: string,
 *   dotClasses: string
 * }}
 */
export function getDeadlineInfo(deadline, isCompletedOrPercent = false) {
  const isCompleted = Boolean(
    isCompletedOrPercent === true ||
    (typeof isCompletedOrPercent === 'number' && isCompletedOrPercent >= 100) ||
    (isCompletedOrPercent && typeof isCompletedOrPercent === 'object' && (
      Number(isCompletedOrPercent.completionPercent ?? isCompletedOrPercent.completionpercent ?? isCompletedOrPercent.compliance ?? 0) >= 100 ||
      isCompletedOrPercent.iscompleted === true ||
      isCompletedOrPercent.isCompleted === true
    ))
  );

  if (!deadline) {
    return {
      hasDeadline: false,
      daysLeft: null,
      status: isCompleted ? 'completed' : 'none',
      label: isCompleted ? 'Completed (No deadline)' : 'No deadline set',
      shortLabel: isCompleted ? 'Completed' : 'No deadline',
      formattedDate: '',
      inputDateValue: '',
      badgeClasses: isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
      dotClasses: isCompleted ? 'bg-emerald-500' : 'bg-slate-400'
    };
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return {
      hasDeadline: false,
      daysLeft: null,
      status: isCompleted ? 'completed' : 'none',
      label: isCompleted ? 'Completed (No deadline)' : 'No deadline set',
      shortLabel: isCompleted ? 'Completed' : 'No deadline',
      formattedDate: '',
      inputDateValue: '',
      badgeClasses: isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
      dotClasses: isCompleted ? 'bg-emerald-500' : 'bg-slate-400'
    };
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffMs = deadlineMidnight.getTime() - todayMidnight.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const inputDateValue = `${year}-${month}-${day}`;

  // If 100% complied, prioritize completed emerald state over overdue/urgent
  if (isCompleted) {
    return {
      hasDeadline: true,
      daysLeft,
      status: 'completed',
      label: `Due ${formattedDate} (Completed)`,
      shortLabel: 'Completed',
      formattedDate,
      inputDateValue,
      badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClasses: 'bg-emerald-500'
    };
  }

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      hasDeadline: true,
      daysLeft,
      status: 'overdue',
      label: `Due ${formattedDate} (${overdueDays}d overdue)`,
      shortLabel: `${overdueDays}d overdue`,
      formattedDate,
      inputDateValue,
      badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClasses: 'bg-rose-500'
    };
  }

  if (daysLeft === 0) {
    return {
      hasDeadline: true,
      daysLeft: 0,
      status: 'due-today',
      label: `Due ${formattedDate} (Due today)`,
      shortLabel: 'Due today',
      formattedDate,
      inputDateValue,
      badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClasses: 'bg-rose-500 animate-pulse'
    };
  }

  if (daysLeft <= 3) {
    return {
      hasDeadline: true,
      daysLeft,
      status: 'urgent',
      label: `Due ${formattedDate} (${daysLeft}d left)`,
      shortLabel: `${daysLeft}d left`,
      formattedDate,
      inputDateValue,
      badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClasses: 'bg-amber-500 animate-pulse'
    };
  }

  if (daysLeft <= 7) {
    return {
      hasDeadline: true,
      daysLeft,
      status: 'upcoming',
      label: `Due ${formattedDate} (${daysLeft}d left)`,
      shortLabel: `${daysLeft}d left`,
      formattedDate,
      inputDateValue,
      badgeClasses: 'bg-amber-50/80 text-amber-700 border-amber-200',
      dotClasses: 'bg-amber-500'
    };
  }

  return {
    hasDeadline: true,
    daysLeft,
    status: 'normal',
    label: `Due ${formattedDate} (${daysLeft}d left)`,
    shortLabel: `${daysLeft}d left`,
    formattedDate,
    inputDateValue,
    badgeClasses: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClasses: 'bg-indigo-500'
  };
}

