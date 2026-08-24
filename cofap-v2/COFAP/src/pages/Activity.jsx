import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowRight, Dumbbell, GraduationCap, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const categories = {
  academic: { label: 'Academic', icon: GraduationCap },
  fitness: { label: 'Fitness', icon: Dumbbell },
  misc: { label: 'Miscellaneous', icon: Sparkles },
};
const POINTS = { fitness: 3, misc: 2 };
const MISC_EXAMPLES = [
  'Helped organize a healthy team dinner',
  'Went to a club or society meeting',
  'Called home and actually talked for a while',
  'Cleaned and reorganized your room',
  'Read a non-academic book for 30+ minutes',
];

function blankTask() {
  return { category: 'academic', description: '', hours: '', visible: true };
}

export default function ActivityPage() {
  const { activeTeam, session, showToast } = useOutletContext();
  const [tasks, setTasks] = useState([blankTask()]);
  const [message, setMessage] = useState('');
  const [miscExample] = useState(() => MISC_EXAMPLES[Math.floor(Math.random() * MISC_EXAMPLES.length)]);

  function addTask() { setTasks([...tasks, blankTask()]); }
  function updateTask(index, key, value) { setTasks(tasks.map((t, i) => (i === index ? { ...t, [key]: value } : t))); }
  function removeTask(index) { setTasks(tasks.filter((_, i) => i !== index)); }

  async function submit(event) {
    event.preventDefault();
    if (!activeTeam) { setMessage('Join a team before logging activity.'); return; }
    if (tasks.some((t) => t.category === 'academic' && (!t.hours || Number(t.hours) <= 0))) {
      setMessage('Academic tasks need hours before submission.');
      return;
    }
    const rows = tasks.map((t) => ({
      group_id: activeTeam.group_id,
      user_id: session.user.id,
      title: t.description || categories[t.category].label,
      category: t.category,
      hours: t.category === 'academic' ? Number(t.hours) : null,
      points: t.category === 'academic' ? Number(t.hours) : POINTS[t.category],
      description: t.description || null,
      description_visible: t.visible,
      activity_date: new Date().toISOString().slice(0, 10),
    }));
    const { error } = await supabase.from('activities').insert(rows);
    if (error) { setMessage(error.message); return; }
    setTasks([blankTask()]);
    setMessage(`${rows.length} task${rows.length > 1 ? 's' : ''} submitted. They're now immutable.`);
    showToast('Activity logged');
  }

  return (
    <>
      <div className="page-heading"><div><p className="kicker">Make it count</p><h2>Log activity</h2></div></div>
      <div className="notice"><ShieldCheck size={17} /><span><b>Review before submitting.</b> Please make sure everything is right — published tasks cannot be edited or deleted.</span></div>
      <form className="task-builder" onSubmit={submit}>
        {tasks.map((task, index) => (
          <div className="task-row" key={index}>
            <div className="task-number">{String(index + 1).padStart(2, '0')}</div>
            <div className="task-fields">
              <div className="task-row-head">
                <b>Task {index + 1}</b>
                {tasks.length > 1 && <button type="button" className="icon-button" onClick={() => removeTask(index)}>×</button>}
              </div>
              <div className="task-controls">
                <label>Type
                  <select value={task.category} onChange={(e) => updateTask(index, 'category', e.target.value)}>
                    {Object.entries(categories).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                  </select>
                </label>
                {task.category === 'academic' && (
                  <label>Hours<input type="number" min="0.5" max="8" step="0.5" value={task.hours} onChange={(e) => updateTask(index, 'hours', e.target.value)} placeholder="0.5–8" /></label>
                )}
                <span className="point-preview">+{task.category === 'academic' ? (task.hours || 0) : POINTS[task.category]} pts</span>
              </div>
              <label>Description <span className="optional">(optional)</span>
                <textarea maxLength="280" value={task.description} onChange={(e) => updateTask(index, 'description', e.target.value)} placeholder={task.category === 'misc' ? `e.g. ${miscExample}` : 'What did you accomplish?'} />
              </label>
              <label className="check"><input type="checkbox" checked={task.visible} onChange={(e) => updateTask(index, 'visible', e.target.checked)} /> Visible to teammates</label>
            </div>
          </div>
        ))}
        <button type="button" className="button secondary add-task" onClick={addTask}><Plus size={16} /> Add another task</button>
        <button className="button primary" type="submit">Submit {tasks.length} task{tasks.length > 1 ? 's' : ''} <ArrowRight size={16} /></button>
        <p className="form-message">{message}</p>
      </form>
    </>
  );
}
