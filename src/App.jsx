import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Brain, Calculator, MessageSquare, Send } from 'lucide-react';

export default function AcademicAgent() {
  const [courses, setCourses] = useState([]);
  const [context, setContext] = useState({ schedule: '', syllabi: '' });
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);
  const chatContainerRef = React.useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const [showBetaBanner, setShowBetaBanner] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (chatContainerRef.current && shouldAutoScroll) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleChatScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    setShouldAutoScroll(isAtBottom);
  };

  const handleSyllabusUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingSyllabus(true);
    
    try {
      const text = await file.text();
      
      const res = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // model is set server-side in netlify/functions/ai-proxy.js
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: 'Extract key information from this syllabus and format it for academic planning. Include: course name, instructor, email, office hours, grading breakdown, extra credit, attendance policy, late work policy, important dates, and any other strategic info. Format with clear headers and bullet points.\n\nSyllabus:\n' + text
          }]
        })
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errBody = await res.json();
          detail = errBody?.error?.message || '';
        } catch (e) {}
        throw new Error('API returned status ' + res.status + (detail ? (': ' + detail) : ''));
      }

      const data = await res.json();
      const extractedInfo = data.content[0].text;
      
      const currentSyllabi = context.syllabi || '';
      const separator = currentSyllabi ? '\n\n==========================================\n\n' : '';
      const updatedSyllabi = currentSyllabi + separator + extractedInfo;
      
      saveCtx({ ...context, syllabi: updatedSyllabi });
      showToast('Syllabus uploaded and parsed successfully!', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Error uploading syllabus. Please try again.', 'error');
    }
    
    setUploadingSyllabus(false);
    e.target.value = '';
  };

  useEffect(() => {
    const load = () => {
      try {
        const coursesData = localStorage.getItem('courses');
        if (coursesData) setCourses(JSON.parse(coursesData));
        
        const contextData = localStorage.getItem('context');
        if (contextData) setContext(JSON.parse(contextData));
        
        const chatData = localStorage.getItem('chatHistory');
        if (chatData) setChatMessages(JSON.parse(chatData));
      } catch (err) {
        console.error('Load error:', err);
      }
    };
    load();
  }, []);

  const save = (c) => {
    setCourses(c);
    try {
      localStorage.setItem('courses', JSON.stringify(c));
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const saveCtx = (c) => {
    setContext(c);
    try {
      localStorage.setItem('context', JSON.stringify(c));
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const addCourse = (name, grade) => {
    save([...courses, { id: crypto.randomUUID(), name, currentGrade: Number(grade) || 0, assignments: [] }]);
  };

  const addAssignment = (cid, name, date, weight) => {
    save(courses.map(c => c.id === cid ? { ...c, assignments: [...c.assignments, { id: crypto.randomUUID(), name, dueDate: date, weight: Number(weight), status: 'not_started', score: null }] } : c));
  };

  const updateStatus = (cid, aid, status) => {
    save(courses.map(c => c.id === cid ? { ...c, assignments: c.assignments.map(a => a.id === aid ? { ...a, status } : a) } : c));
  };

  const updateScore = (cid, aid, score) => {
    save(courses.map(c => c.id === cid ? { ...c, assignments: c.assignments.map(a => a.id === aid ? { ...a, score: Number(score) } : a) } : c));
  };

  const deleteCourse = (id) => save(courses.filter(c => c.id !== id));
  
  const deleteAssignment = (cid, aid) => save(courses.map(c => c.id === cid ? { ...c, assignments: c.assignments.filter(a => a.id !== aid) } : c));

  const calcImpact = (course, assignment) => {
    const done = course.assignments.filter(a => a.status === 'completed' && a.score != null);
    
    let earnedPoints = 0;
    let totalCompletedWeight = 0;
    
    for (const a of done) {
      earnedPoints += a.score * (a.weight / 100);
      totalCompletedWeight += parseFloat(a.weight);
    }
    
    const currentGrade = totalCompletedWeight > 0 ? (earnedPoints / totalCompletedWeight) * 100 : 0;
    
    const calcNewGrade = (score) => {
      const newEarnedPoints = earnedPoints + (score * (assignment.weight / 100));
      const newTotalWeight = totalCompletedWeight + parseFloat(assignment.weight);
      return Math.round((newEarnedPoints / newTotalWeight) * 100 * 10) / 10;
    };
    
    return {
      current: Math.round(currentGrade * 10) / 10,
      if100: calcNewGrade(100),
      if90: calcNewGrade(90),
      if80: calcNewGrade(80),
      if70: calcNewGrade(70)
    };
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const today = new Date();
      const pending = courses.flatMap(c => c.assignments.filter(a => a.status !== 'completed').map(a => {
        const daysUntil = Math.ceil((new Date(a.dueDate) - today) / 864e5);
        return {
          id: a.id,
          courseId: c.id,
          course: c.name,
          name: a.name,
          due: a.dueDate,
          weight: a.weight,
          status: a.status,
          daysUntil: daysUntil
        };
      }));
      
      const completed = courses.flatMap(c => c.assignments.filter(a => a.status === 'completed').map(a => ({
        name: a.name,
        course: c.name,
        score: a.score,
        weight: a.weight
      })));
      
      const coursesData = JSON.stringify(courses.map(c => ({ name: c.name, assignmentCount: c.assignments.length })));
      const pendingData = JSON.stringify(pending.slice(0, 10));
      const completedData = JSON.stringify(completed.slice(0, 5));
      const scheduleData = context.schedule || '';
      const syllabiData = context.syllabi ? context.syllabi.substring(0, 1000) : '';
      const todayStr = today.toLocaleDateString();
      
      const systemPrompt = 'You are an empathetic academic advisor assistant. Today is ' + todayStr + '.\n\nSTUDENT DATA:\nCourses: ' + coursesData + '\nPending: ' + pendingData + '\nCompleted: ' + completedData + '\nSchedule: ' + scheduleData + '\nSyllabi: ' + syllabiData + '\n\nCAPABILITIES:\n- Answer questions about schedule, assignments, deadlines\n- Provide study advice\n- Offer emotional support\n- Help update assignment status\n\nACTIONS:\nWhen user reports completing work, respond with:\n[ACTION: UPDATE_ASSIGNMENT, courseName: "X", assignmentName: "Y", status: completed, score: Z]\n\nBe supportive and concise (2-3 paragraphs max).';

      const conversationHistory = newMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const res = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // model is set server-side in netlify/functions/ai-proxy.js
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationHistory
        })
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errBody = await res.json();
          detail = errBody?.error?.message || '';
        } catch (e) {}
        throw new Error('API returned status ' + res.status + (detail ? (': ' + detail) : ''));
      }
      
      const data = await res.json();
      const assistantMessage = data.content[0].text;
      
      const actionRegex = /\[ACTION: UPDATE_ASSIGNMENT, courseName: "([^"]+)", assignmentName: "([^"]+)", status: (\w+), score: (\d+)\]/;
      const actionMatch = assistantMessage.match(actionRegex);
      
      if (actionMatch) {
        const courseName = actionMatch[1];
        const assignmentName = actionMatch[2];
        const status = actionMatch[3];
        const score = actionMatch[4];
        const course = courses.find(c => c.name.toLowerCase().includes(courseName.toLowerCase()));
        if (course) {
          const assignment = course.assignments.find(a => a.name.toLowerCase().includes(assignmentName.toLowerCase()));
          if (assignment) {
            updateStatus(course.id, assignment.id, status);
            if (score) updateScore(course.id, assignment.id, score);
          }
        }
      }
      
      const cleanMessage = assistantMessage.replace(/\[ACTION:.*?\]/g, '').trim();
      const updatedMessages = [...newMessages, { role: 'assistant', content: cleanMessage }];
      setChatMessages(updatedMessages);
      try {
        localStorage.setItem('chatHistory', JSON.stringify(updatedMessages));
      } catch (err) {
        console.error('Save chat error:', err);
      }
    } catch (e) {
      console.error(e);
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error: ' + (e?.message || 'unknown error') + '. Please try again.' }]);
    }
    
    setChatLoading(false);
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };

  const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const weekLabel = (dateStr, thisWeekStart) => {
    const target = getWeekStart(new Date(dateStr));
    const diffDays = Math.round((target - thisWeekStart) / 864e5);
    const weekNum = Math.floor(diffDays / 7) + 1;
    const end = new Date(target);
    end.setDate(target.getDate() + 6);
    return 'Week ' + weekNum + ' (' + fmtShort(target) + '\u2013' + fmtShort(end) + ')';
  };

  const getRecs = async () => {
    setLoading(true);
    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    const pending = courses.flatMap(c => c.assignments.filter(a => a.status !== 'completed').map(a => {
      const imp = calcImpact(c, a);
      const daysUntil = Math.ceil((new Date(a.dueDate) - today) / 864e5);
      return {
        course: c.name,
        name: a.name,
        due: a.dueDate,
        weekLabel: weekLabel(a.dueDate, thisWeekStart),
        weight: a.weight,
        days: daysUntil,
        currentGrade: imp.current,
        if100: imp.if100,
        if90: imp.if90,
        if80: imp.if80,
        if70: imp.if70
      };
    }));

    if (!pending.length) {
      setRecs({ 
        top: 'All done!', 
        reason: 'No pending assignments', 
        gradeImpactData: null,
        comparative: '',
        nextWeeks: [],
        today: '',
        schedule: [],
        office: '',
        extra: '',
        risks: [],
        leverage: [],
        workloadBalance: [],
        dependencies: [],
        semesterStrategy: [],
        cushionTracking: []
      });
      setLoading(false);
      return;
    }

    try {
      const allAssignments = courses.flatMap(c => c.assignments);
      const totalAssignments = allAssignments.length;
      const completedCount = allAssignments.filter(a => a.status === 'completed').length;
      
      const scheduleText = context.schedule || 'No schedule provided';
      const hasSyllabus = !!context.syllabi;
      const syllabiText = hasSyllabus ? context.syllabi.substring(0, 2000) : 'No syllabus uploaded for this course yet.';
      const pendingText = JSON.stringify(pending.slice(0, 15), null, 2);
      const todayStr = today.toLocaleDateString();
      const lastDue = pending.reduce((max, a) => new Date(a.due) > new Date(max) ? a.due : max, pending[0].due);
      const lastWeekLabel = weekLabel(lastDue, thisWeekStart);
      
      const promptContent = 'You are an expert academic advisor. Today is ' + todayStr + ' (' + weekLabel(today.toISOString(), thisWeekStart) + ').\n\n' +
        'SEMESTER OVERVIEW:\n- Total Assignments: ' + totalAssignments + '\n- Completed: ' + completedCount + '\n- Remaining: ' + (totalAssignments - completedCount) + '\n- Planning horizon: today through ' + lastWeekLabel + ' (the last currently-known due date)\n\n' +
        'STUDENT SCHEDULE:\n' + scheduleText + '\n\n' +
        'SYLLABUS INFORMATION (' + (hasSyllabus ? 'provided' : 'NONE PROVIDED') + '):\n' + syllabiText + '\n\n' +
        'PENDING ASSIGNMENTS (includes pre-calculated week labels and exact grade-scenario numbers \u2014 use these values exactly, do not recompute):\n' + pendingText + '\n\n' +
        'CRITICAL RULES:\n' +
        '1. WEEKS: Every pending assignment above already has a "weekLabel" field like "Week 3 (Sep 2\u2013Sep 8)". Always reuse these exact labels for any week reference. Never invent, calculate, or use absolute calendar week numbers (like "Week 34") \u2014 only the relative labels provided.\n' +
        '2. GRADE MATH: Do not calculate or mention grade percentages yourself \u2014 that is handled separately by the app using the exact if100/if90/if80/if70 numbers already in the data. Do not include grade math in any of your text fields.\n' +
        '3. NO FABRICATION: If SYLLABUS INFORMATION says "NONE PROVIDED", do not invent specific office hours, policies, or extra-credit opportunities. Instead say plainly that no syllabus has been uploaded yet for that course. Only state specifics that appear in the syllabus text above.\n' +
        '4. PLANNING HORIZON: "nextWeeks" should cover every week from today through the planning horizon above (not just 2 weeks), so it reflects the whole current stretch of the semester with known deadlines.\n\n' +
        'Respond with JSON only (no markdown, no code fences):\n' +
        '{\n' +
        '  "top": "Assignment name and due date",\n' +
        '  "reason": "Why this is priority \u2014 urgency and effort, no grade math",\n' +
        '  "comparative": "Brief comparison to the next 1-2 highest-priority items, no grade math",\n' +
        '  "nextWeeks": [{"week": "exact weekLabel from data", "tasks": ["short task (Xh)", "short task (Xh)"]}],\n' +
        '  "leverage": [{"item": "assignment name", "why": "one short sentence"}],\n' +
        '  "today": "One concrete action for today, with a time estimate",\n' +
        '  "schedule": [{"day": "Monday", "date": "exact date like Aug 19", "time": "7:00 PM\u20139:00 PM", "task": "what to work on"}] (cover the FULL planning horizon above with 1-2 blocks per week, not just the immediate week \u2014 this populates the calendar across the whole semester),\n' +
        '  "office": "Office hours info FROM THE SYLLABUS ONLY, or a plain note that none was provided",\n' +
        '  "extra": "Extra credit FROM THE SYLLABUS ONLY, or a plain note that none was provided",\n' +
        '  "risks": ["short risk with a one-line prevention tip"],\n' +
        '  "workloadBalance": [{"period": "exact weekLabel or range of weekLabels", "load": "light|moderate|heavy", "note": "why, one short sentence"}],\n' +
        '  "dependencies": [{"from": "assignment or task", "to": "assignment it feeds into", "note": "one short sentence"}],\n' +
        '  "semesterStrategy": [{"phase": "Phase 1", "weeks": "weekLabel range", "focus": "one short sentence"}],\n' +
        '  "cushionTracking": ["one short, concrete tip \u2014 e.g. how much buffer the student currently has, or a specific early-warning sign to watch for. NOT generic advice like \\"make a spreadsheet\\" \u2014 the app already has a Grades tab that tracks this precisely, so these tips should add insight, not suggest rebuilding that."]\n' +
        '}';
      
      const res = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // model is set server-side in netlify/functions/ai-proxy.js
          max_tokens: 6000,
          // widened schedule coverage needs more room than a single week did
          messages: [{ role: 'user', content: promptContent }]
        })
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errBody = await res.json();
          detail = errBody?.error?.message || '';
        } catch (e) {}
        throw new Error('API returned status ' + res.status + (detail ? (': ' + detail) : ''));
      }
      
      const d = await res.json();
      
      if (d.error) {
        console.error('API Error:', d.error);
        const errorMessage = d.error.message || 'API error occurred';
        setRecs({ 
          top: 'Error', 
          reason: errorMessage,
          gradeImpactData: null,
          comparative: '',
          nextWeeks: [],
          today: '',
          schedule: [],
          office: '',
          extra: '',
          risks: [],
          leverage: [],
          workloadBalance: [],
          dependencies: [],
          semesterStrategy: [],
          cushionTracking: []
        });
        setLoading(false);
        return;
      }
      
      const text = d.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const parsedRecs = JSON.parse(text);

      // Match the AI's chosen top-priority assignment back to our own exact,
      // pre-calculated grade numbers. The AI never computes grade math itself.
      const topMatch = pending.find(p => parsedRecs.top && parsedRecs.top.toLowerCase().includes(p.name.toLowerCase()));
      const gradeImpactData = topMatch ? {
        assignment: topMatch.name,
        weight: topMatch.weight,
        scenarios: [
          { score: 100, grade: topMatch.if100 },
          { score: 90, grade: topMatch.if90 },
          { score: 80, grade: topMatch.if80 },
          { score: 70, grade: topMatch.if70 }
        ]
      } : null;
      
      const scheduleArr = Array.isArray(parsedRecs.schedule) ? parsedRecs.schedule : [];
      setRecs({
        top: parsedRecs.top || 'No priority',
        reason: parsedRecs.reason || '',
        gradeImpactData,
        comparative: parsedRecs.comparative || '',
        nextWeeks: Array.isArray(parsedRecs.nextWeeks) ? parsedRecs.nextWeeks : [],
        leverage: Array.isArray(parsedRecs.leverage) ? parsedRecs.leverage : [],
        today: parsedRecs.today || '',
        schedule: scheduleArr,
        office: parsedRecs.office || '',
        extra: parsedRecs.extra || '',
        risks: parsedRecs.risks || [],
        workloadBalance: Array.isArray(parsedRecs.workloadBalance) ? parsedRecs.workloadBalance : [],
        dependencies: Array.isArray(parsedRecs.dependencies) ? parsedRecs.dependencies : [],
        semesterStrategy: Array.isArray(parsedRecs.semesterStrategy) ? parsedRecs.semesterStrategy : [],
        cushionTracking: Array.isArray(parsedRecs.cushionTracking) ? parsedRecs.cushionTracking : []
      });
    } catch (e) {
      console.error('Recommendation Error:', e);
      const errorMsg = 'Please try again. Error: ' + String(e.message || e);
      setRecs({ 
        top: 'Error generating recommendations', 
        reason: errorMsg,
        gradeImpactData: null,
        comparative: '',
        nextWeeks: [],
        today: '',
        schedule: [],
        office: '',
        extra: '',
        risks: [],
        leverage: [],
        workloadBalance: [],
        dependencies: [],
        semesterStrategy: [],
        cushionTracking: []
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {toast && (
        <div className={'fixed top-6 right-6 z-50 rounded-xl px-5 py-3 border-2 shadow-2xl ' + (toast.type === 'error' ? 'bg-red-900/90 border-red-500/50' : 'bg-purple-900/90 border-purple-500/50')}>
          <p className={toast.type === 'error' ? 'text-red-200 text-sm font-medium' : 'text-purple-100 text-sm font-medium'}>{toast.message}</p>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-3">
            <Brain className="w-10 h-10 text-purple-400" />Academic Agent
          </h1>
          <p className="text-purple-300">Smart academic advisor with AI-powered features</p>
        </div>

        {showBetaBanner && (
          <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-4 mb-4 relative">
            <button
              onClick={() => setShowBetaBanner(false)}
              aria-label="Dismiss beta notice"
              className="absolute top-3 right-3 text-purple-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="text-purple-300 text-lg">✦</div>
              <div>
                <h3 className="text-purple-200 font-semibold text-sm mb-1">You're on Beta v1</h3>
                <p className="text-purple-300 text-sm leading-relaxed">
                  Core planning, grade tracking, and AI recommendations are live. A few features are marked "Coming Soon" as we roll out the next update.
                </p>
              </div>
            </div>
          </div>
        )}

        {showWarning && (
          <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-xl p-4 mb-6 relative">
            <button 
              onClick={() => setShowWarning(false)}
              aria-label="Dismiss storage warning"
              className="absolute top-2 right-2 text-yellow-300 hover:text-yellow-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-start gap-3">
              <div className="text-3xl">💡</div>
              <div>
                <h3 className="text-yellow-100 font-bold text-lg mb-1">Important: Your Data is Saved Locally</h3>
                <p className="text-yellow-200 text-sm mb-2">
                  Your courses and assignments are saved in your browser on THIS device. Your data will persist between sessions, but:
                </p>
                <ul className="text-yellow-200 text-sm space-y-1 ml-4">
                  <li>• <strong>Don't use Incognito/Private mode</strong> - your data will be deleted when you close the window</li>
                  <li>• <strong>Avoid clearing browser data</strong> - this will delete all your courses and assignments</li>
                  <li>• <strong>Data is device-specific</strong> - using a different device or browser starts fresh</li>
                </ul>
                <p className="text-yellow-200 text-sm mt-2 italic">
                  💾 Tip: Take screenshots or notes of important assignments as backup!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-2 border border-purple-500/30">
          {[['overview', 'Overview'], ['grades', 'Grades'], ['calendar', 'Calendar'], ['context', 'Context']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={'flex-1 px-4 py-2 rounded-lg font-semibold transition-all ' + (tab === t ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white')}>{l}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
              <div className="flex justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Recommendations</h2>
                <button onClick={getRecs} disabled={loading || !courses.length} className="bg-purple-600 text-white px-6 py-2 rounded-lg">
                  {loading ? 'Analyzing...' : 'Get Recommendations'}
                </button>
              </div>
              {recs ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <HoverCard 
                    icon="🎯" 
                    title="Top Priority" 
                    preview={recs.top.split(' ').slice(0, 4).join(' ') + '...'}
                    content={recs.top + '\n\n' + recs.reason}
                    gradient="from-purple-600 to-purple-800"
                    pulse={true}
                  />
                  
                  {recs.gradeImpactData && (
                    <HoverCard 
                      icon="📊" 
                      title="Grade Impact" 
                      preview="Score scenarios"
                      content={
                        <div>
                          <p className="mb-3 text-white/90">{recs.gradeImpactData.assignment} <span className="text-gray-400">({recs.gradeImpactData.weight}% of course grade)</span></p>
                          {recs.gradeImpactData.scenarios.map((s, i) => (
                            <div key={i} className="flex justify-between mb-1.5 text-sm">
                              <span className="text-gray-300">If you score {s.score}%</span>
                              <span className="font-semibold text-white">your grade becomes {s.grade}%</span>
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-green-600 to-emerald-800"
                    />
                  )}

                  {recs.comparative && (
                    <HoverCard 
                      icon="⚖️" 
                      title="Compare Options" 
                      preview="Priority tradeoffs"
                      content={recs.comparative}
                      gradient="from-blue-600 to-cyan-800"
                    />
                  )}

                  {recs.nextWeeks && recs.nextWeeks.length > 0 && (
                    <HoverCard 
                      icon="📅" 
                      title="Upcoming Weeks" 
                      preview="Week-by-week plan"
                      content={
                        <div>
                          {recs.nextWeeks.map((w, i) => (
                            <div key={i} className="mb-3">
                              <p className="font-bold text-purple-300 mb-1">{w.week}</p>
                              {(w.tasks || []).map((t, j) => (
                                <div key={j} className="ml-3 text-sm text-gray-200 mb-0.5">• {t}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-cyan-600 to-teal-800"
                    />
                  )}

                  {recs.leverage && recs.leverage.length > 0 && (
                    <HoverCard 
                      icon="💎" 
                      title="High Impact" 
                      preview="Biggest opportunities"
                      content={
                        <div>
                          {recs.leverage.map((l, i) => (
                            <div key={i} className="mb-2.5">
                              <p className="font-semibold text-white text-sm">{l.item}</p>
                              <p className="text-gray-300 text-sm">{l.why}</p>
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-indigo-600 to-purple-800"
                    />
                  )}
                  
                  {recs.today && (
                    <HoverCard 
                      icon="📋" 
                      title="Today's Action" 
                      preview="Start now"
                      content={recs.today}
                      gradient="from-pink-600 to-rose-800"
                    />
                  )}
                  
                  {recs.schedule && recs.schedule.length > 0 && (
                    <HoverCard 
                      icon="🕐" 
                      title="Study Blocks" 
                      preview="This week's schedule"
                      content={
                        <div>
                          {recs.schedule.map((s, i) => (
                            <div key={i} className="mb-2 text-sm">
                              <span className="font-semibold text-white">{s.day} {s.date}, {s.time}</span>
                              <div className="text-gray-300">{s.task}</div>
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-amber-600 to-orange-800"
                    />
                  )}
                  
                  {recs.office && (
                    <HoverCard 
                      icon="👨‍🏫" 
                      title="Office Hours" 
                      preview="Get help"
                      content={recs.office}
                      gradient="from-violet-600 to-purple-800"
                    />
                  )}
                  
                  {recs.extra && (
                    <HoverCard 
                      icon="⭐" 
                      title="Extra Credit" 
                      preview="Bonus opportunities"
                      content={recs.extra}
                      gradient="from-yellow-600 to-amber-800"
                    />
                  )}
                  
                  {recs.risks && recs.risks.length > 0 && (
                    <HoverCard 
                      icon="⚠️" 
                      title="Risk Alerts" 
                      preview={recs.risks.length + ' warnings'}
                      content={recs.risks.map((r, i) => '• ' + r).join('\n\n')}
                      gradient="from-red-600 to-rose-800"
                    />
                  )}
                  
                  {recs.workloadBalance && recs.workloadBalance.length > 0 && (
                    <HoverCard 
                      icon="📊" 
                      title="Workload Balance" 
                      preview="Weekly distribution"
                      content={
                        <div>
                          {recs.workloadBalance.map((w, i) => (
                            <div key={i} className="mb-2.5 text-sm">
                              <span className="font-semibold text-white">{w.period}</span>
                              <span className={'ml-2 px-2 py-0.5 rounded text-xs font-semibold ' + (w.load === 'heavy' ? 'bg-red-500/30 text-red-200' : w.load === 'light' ? 'bg-green-500/30 text-green-200' : 'bg-yellow-500/30 text-yellow-200')}>{w.load}</span>
                              <div className="text-gray-300 mt-0.5">{w.note}</div>
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-teal-600 to-cyan-800"
                    />
                  )}
                  
                  {recs.dependencies && recs.dependencies.length > 0 && (
                    <HoverCard 
                      icon="🔗" 
                      title="Dependencies" 
                      preview="Assignment order"
                      content={
                        <div>
                          {recs.dependencies.map((dep, i) => (
                            <div key={i} className="mb-2.5 text-sm">
                              <div className="text-white font-medium">{dep.from} <span className="text-purple-300">→</span> {dep.to}</div>
                              <div className="text-gray-300">{dep.note}</div>
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-orange-600 to-red-800"
                    />
                  )}
                  
                  {recs.semesterStrategy && recs.semesterStrategy.length > 0 && (
                    <HoverCard 
                      icon="🎓" 
                      title="Semester Strategy" 
                      preview="Long-term planning"
                      content={
                        <div>
                          {recs.semesterStrategy.map((p, i) => (
                            <div key={i} className="mb-2.5">
                              <p className="font-bold text-purple-300">{p.phase} <span className="text-gray-400 font-normal">({p.weeks})</span></p>
                              <p className="text-sm text-gray-200">{p.focus}</p>
                            </div>
                          ))}
                        </div>
                      }
                      gradient="from-purple-600 to-indigo-800"
                    />
                  )}
                  
                  {recs.cushionTracking && recs.cushionTracking.length > 0 && (
                    <HoverCard 
                      icon="📈" 
                      title="Grade Cushion" 
                      preview="Performance tracking"
                      content={
                        <div>
                          {recs.cushionTracking.map((tip, i) => (
                            <div key={i} className="mb-2 text-sm text-gray-200">• {tip}</div>
                          ))}
                        </div>
                      }
                      gradient="from-emerald-600 to-green-800"
                    />
                  )}
                </div>
              ) : <p className="text-purple-300 text-center py-8">Add courses to get started</p>}
            </div>

            <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30 flex flex-col items-center justify-center text-center gap-2 min-h-[160px]">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-200 text-lg">🔒</div>
              <h3 className="font-semibold text-white text-base">Study Group Sync</h3>
              <p className="text-purple-300 text-sm max-w-xs">Coordinate study blocks with classmates automatically.</p>
              <span className="mt-1 text-[10px] font-semibold tracking-wide uppercase text-purple-200 bg-purple-500/10 border border-purple-500/30 rounded-full px-3 py-1">Coming Soon</span>
            </div>

            <AddCourseForm onAdd={addCourse} />
            
            <div className="space-y-4">
              {courses.map(c => (
                <CourseCard key={c.id} course={c} onAddAssignment={addAssignment} onUpdateStatus={updateStatus} onUpdateScore={updateScore} onDelete={deleteCourse} onDeleteAssignment={deleteAssignment} calcImpact={calcImpact} />
              ))}
            </div>
          </div>
        )}

        {tab === 'grades' && (
          <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-purple-400" />
              Grade Impact Calculator
            </h2>
            <p className="text-purple-300 mb-6">See exactly how each assignment affects your course grade</p>
            {courses.map(c => {
              const pending = c.assignments.filter(a => a.status !== 'completed');
              if (!pending.length) return null;
              return (
                <div key={c.id} className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-3">{c.name}</h3>
                  {pending.map(a => {
                    const imp = calcImpact(c, a);
                    return (
                      <div key={a.id} className="bg-white/5 rounded-lg p-4 mb-3 border border-purple-500/20">
                        <h4 className="text-white font-semibold mb-2">{a.name} ({a.weight}% of final grade)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[['100%', imp.if100, 'green'], ['90%', imp.if90, 'blue'], ['80%', imp.if80, 'yellow'], ['70%', imp.if70, 'red']].map(([l, v, color]) => (
                            <div key={l} className={'bg-' + color + '-500/20 rounded p-3 text-center border border-' + color + '-400/30'}>
                              <p className={'text-' + color + '-300 font-semibold text-xs mb-1'}>If you score {l}</p>
                              <p className="text-white font-bold text-xl">{v}%</p>
                              <p className={'text-' + color + '-200 text-xs mt-1'}>
                                {v - imp.current >= 0 ? '+' : ''}{(v - imp.current).toFixed(1)}% impact
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {courses.every(c => !c.assignments.some(a => a.status !== 'completed')) && (
              <p className="text-purple-300 text-center py-8">No pending assignments</p>
            )}
          </div>
        )}

        {tab === 'calendar' && (
          <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-purple-400" />
              Semester Calendar & Study Schedule
            </h2>
            <CalendarView courses={courses} context={context} recs={recs} />
          </div>
        )}

        {tab === 'context' && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3">Schedule</h2>
              <textarea value={context.schedule} onChange={(e) => saveCtx({ ...context, schedule: e.target.value })} placeholder="Monday: 9am-12pm Classes..." className="w-full h-40 px-4 py-3 rounded-lg bg-white/10 border border-purple-500/30 text-white" />
            </div>
            <div className="bg-white/10 rounded-xl p-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-white">Syllabus Info</h2>
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-2">
                  {uploadingSyllabus ? 'Uploading...' : '📄 Upload Syllabus'}
                  <input 
                    type="file" 
                    accept=".txt,.pdf,.doc,.docx" 
                    onChange={handleSyllabusUpload}
                    disabled={uploadingSyllabus}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-purple-300 text-sm mb-3">Upload a syllabus file (TXT, PDF) and the AI will automatically extract relevant information</p>
              <textarea value={context.syllabi} onChange={(e) => saveCtx({ ...context, syllabi: e.target.value })} placeholder="Paste syllabi (office hours, extra credit, policies)..." className="w-full h-48 px-4 py-3 rounded-lg bg-white/10 border border-purple-500/30 text-white" />
            </div>
          </div>
        )}
      </div>
      
      <div className="fixed bottom-6 right-6 z-50">
        {!chatOpen ? (
          <button 
            onClick={() => setChatOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform duration-300 flex items-center gap-2"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="font-semibold">Chat with Agent</span>
          </button>
        ) : (
          <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl shadow-2xl border-2 border-purple-500/30 w-96 h-[600px] flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-t-2xl flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Academic Agent</h3>
              </div>
              <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-white hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div 
              className="flex-1 p-4 space-y-3"
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              style={{
                overflowY: 'scroll',
                overflowX: 'hidden',
                maxHeight: '450px',
                scrollBehavior: 'smooth'
              }}
            >
              <style>{`
                div[style*="overflowY: scroll"]::-webkit-scrollbar {
                  width: 12px;
                }
                div[style*="overflowY: scroll"]::-webkit-scrollbar-track {
                  background: #1e1b4b;
                  border-radius: 10px;
                }
                div[style*="overflowY: scroll"]::-webkit-scrollbar-thumb {
                  background: #9333ea;
                  border-radius: 10px;
                  border: 2px solid #1e1b4b;
                }
                div[style*="overflowY: scroll"]::-webkit-scrollbar-thumb:hover {
                  background: #a855f7;
                }
              `}</style>
              
              {chatMessages.length === 0 && (
                <div className="text-center text-purple-300 py-8">
                  <p className="mb-2">👋 Hi! I am your academic advisor.</p>
                  <p className="text-sm">Ask me anything about your semester, assignments, or just let me know what you have completed!</p>
                </div>
              )}
              
              {chatMessages.map((msg, i) => (
                <div key={i} className={'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] rounded-2xl px-4 py-2 ' + (msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-100 border border-purple-500/30')}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-purple-500/30 rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-purple-500/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !chatLoading && sendChatMessage()}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCourseForm({ onAdd }) {
  const [show, setShow] = useState(false);
  return show ? (
    <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
      <h3 className="text-lg font-bold text-white mb-4">Add New Course</h3>
      <input id="cn" type="text" placeholder="Course name" className="w-full px-4 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white mb-3" />
      <input id="cg" type="number" placeholder="Current grade (0 if semester hasn't started)" className="w-full px-4 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white mb-3" />
      <div className="flex gap-2">
        <button onClick={() => { const n = document.getElementById('cn').value; if (n) { onAdd(n, document.getElementById('cg').value); setShow(false); }}} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Add Course</button>
        <button onClick={() => setShow(false)} className="bg-gray-600 text-white px-4 py-2 rounded-lg">Cancel</button>
      </div>
    </div>
  ) : (
    <button onClick={() => setShow(true)} className="bg-purple-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"><Plus className="w-5 h-5" />Add Course</button>
  );
}

function CourseCard({ course, onAddAssignment, onUpdateStatus, onUpdateScore, onDelete, onDeleteAssignment }) {
  const [show, setShow] = useState(false);
  const totalWeight = course.assignments.reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
  return (
    <div className="bg-white/10 rounded-xl p-6 border border-purple-500/30">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{course.name}</h2>
        <button onClick={() => onDelete(course.id)} aria-label={'Delete ' + course.name} className="text-red-400 hover:text-red-300"><X className="w-5 h-5" /></button>
      </div>

      {course.assignments.length > 0 && Math.round(totalWeight) !== 100 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          Assignment weights total {Math.round(totalWeight)}%, not 100% — grade calculations for this course may not reflect your actual syllabus breakdown.
        </div>
      )}
      
      {course.assignments.map(a => (
        <div key={a.id} className="bg-white/5 rounded-lg p-4 mb-3 border border-purple-500/20 hover:bg-white/10 transition-all">
          <div className="flex justify-between mb-2">
            <div>
              <h3 className="text-white font-semibold">{a.name}</h3>
              <p className="text-purple-300 text-sm">{new Date(a.dueDate).toLocaleDateString()} | {a.weight}%</p>
            </div>
            <button onClick={() => onDeleteAssignment(course.id, a.id)} aria-label={'Delete ' + a.name} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            <select value={a.status} onChange={(e) => onUpdateStatus(course.id, a.id, e.target.value)} className="bg-purple-600/30 text-white px-3 py-1 rounded text-sm border border-purple-500/30">
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            {a.status === 'completed' && <input type="number" placeholder="Score %" value={a.score || ''} onChange={(e) => onUpdateScore(course.id, a.id, e.target.value)} className="w-24 px-3 py-1 rounded bg-white/10 text-white text-sm border border-purple-500/30" />}
          </div>
        </div>
      ))}

      {!show ? (
        <button onClick={() => setShow(true)} className="text-purple-300 hover:text-purple-200 flex items-center gap-2 transition-all"><Plus className="w-4 h-4" />Add Assignment</button>
      ) : (
        <div className="bg-white/5 rounded-lg p-4 space-y-3 border border-purple-500/20">
          <input id={'an' + course.id} type="text" placeholder="Assignment name" className="w-full px-3 py-2 rounded bg-white/10 text-white text-sm border border-purple-500/30" />
          <div className="flex gap-2">
            <input id={'ad' + course.id} type="date" className="flex-1 px-3 py-2 rounded bg-white/10 text-white text-sm border border-purple-500/30" />
            <input id={'aw' + course.id} type="number" placeholder="Weight %" className="w-24 px-3 py-2 rounded bg-white/10 text-white text-sm border border-purple-500/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const n = document.getElementById('an' + course.id).value; const d = document.getElementById('ad' + course.id).value; const w = document.getElementById('aw' + course.id).value; if (n && d && w) { onAddAssignment(course.id, n, d, w); setShow(false); }}} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm">Add</button>
            <button onClick={() => setShow(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HoverCard({ icon, title, preview, content, gradient, pulse }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const formatContent = (text) => {
    if (typeof text !== 'string') {
      return text;
    }
    return text.split('\n').map((line, i) => {
      if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
        return <div key={i} className="ml-4 mb-2">{line}</div>;
      } else if (line.trim().match(/^[A-Z][A-Za-z\s]+:/)) {
        return <div key={i} className="font-bold mt-3 mb-1 text-purple-300">{line}</div>;
      } else if (line.trim()) {
        return <div key={i} className="mb-2">{line}</div>;
      }
      return <div key={i} className="mb-2"></div>;
    });
  };
  
  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={'bg-gradient-to-br ' + gradient + ' rounded-2xl p-6 border-2 border-white/20 shadow-2xl transform transition-all duration-300 hover:scale-105 hover:rotate-1 cursor-pointer' + (pulse ? ' animate-pulse' : '')}>
        <div className="text-6xl mb-3 text-center">{icon}</div>
        <h3 className="text-white font-bold text-lg text-center mb-2">{title}</h3>
        <p className="text-white/80 text-sm text-center">{preview}</p>
      </div>
      
      {isHovered && content && (
        <div className="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-2 w-96 max-w-[90vw] bg-gray-900 border-2 border-white/30 rounded-xl p-5 shadow-2xl">
          <div className="text-2xl mb-2">{icon}</div>
          <h4 className="text-white font-bold text-lg mb-3">{title}</h4>
          <div className="text-gray-200 text-sm leading-relaxed max-h-96 overflow-y-auto">
            {formatContent(content)}
          </div>
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 border-l-2 border-t-2 border-white/30 rotate-45"></div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ courses, context, recs }) {
  const getWeekStart = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };
  const todayDate = new Date();
  const thisWeekStart = getWeekStart(todayDate);

  const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabelFor = (date) => {
    const target = getWeekStart(date);
    const diffDays = Math.round((target - thisWeekStart) / 864e5);
    const weekNum = Math.floor(diffDays / 7) + 1;
    const end = new Date(target);
    end.setDate(target.getDate() + 6);
    return 'Week ' + weekNum + ' (' + fmtShort(target) + '\u2013' + fmtShort(end) + ')';
  };

  const [selectedWeek, setSelectedWeek] = useState(0);
  const [hoveredBlock, setHoveredBlock] = useState(null);
  
  const allAssignments = courses.flatMap(c => c.assignments.map(a => ({ ...a, course: c.name })));
  
  const currentWeekStart = new Date(thisWeekStart);
  currentWeekStart.setDate(thisWeekStart.getDate() + (selectedWeek * 7));

  const currentWeekLabel = weekLabelFor(currentWeekStart);
  const recommendedThisWeek = recs && recs.nextWeeks ? recs.nextWeeks.find(w => w.week === currentWeekLabel) : null;
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(currentWeekStart.getDate() + i);
    days.push(day);
  }
  
  const timeBlocks = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
  
  const getAssignmentsForDay = (day) => {
    return allAssignments.filter(a => new Date(a.dueDate).toDateString() === day.toDateString());
  };
  
  const convertTo24Hour = (hour, period) => {
    if (!period) return hour;
    if (period.toUpperCase() === 'PM' && hour !== 12) return hour + 12;
    if (period.toUpperCase() === 'AM' && hour === 12) return 0;
    return hour;
  };

  // Parse the AI's recommended study blocks (recs.schedule) into actual
  // dated, hour-ranged entries we can place on the grid, same way the
  // fixed weekly schedule is parsed below.
  const parseAiTimeRange = (timeStr) => {
    if (!timeStr) return null;
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\D+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    return {
      startHour: convertTo24Hour(parseInt(m[1]), m[3] || m[6]),
      endHour: convertTo24Hour(parseInt(m[4]), m[6])
    };
  };

  const aiBlocksByDate = {};
  if (recs && Array.isArray(recs.schedule)) {
    recs.schedule.forEach(block => {
      if (!block.date || !block.time) return;
      const parsedDate = new Date(block.date + ' ' + currentWeekStart.getFullYear());
      if (isNaN(parsedDate)) return;
      const range = parseAiTimeRange(block.time);
      if (!range) return;
      const key = parsedDate.toDateString();
      if (!aiBlocksByDate[key]) aiBlocksByDate[key] = [];
      aiBlocksByDate[key].push({ ...range, task: block.task, time: block.time });
    });
  }
  
  const parseSchedule = () => {
    const schedule = {};
    if (!context || !context.schedule) return schedule;
    
    const lines = context.schedule.split('\n');
    let currentDay = '';
    
    lines.forEach(line => {
      const dayMatch = line.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY):/i);
      if (dayMatch) {
        currentDay = dayMatch[1].charAt(0) + dayMatch[1].slice(1).toLowerCase();
        schedule[currentDay] = [];
      } else if (currentDay && line.trim()) {
        const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?.*?-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?.*?-\s*(.+)/i);
        if (timeMatch) {
          const startHour = timeMatch[1];
          const startPeriod = timeMatch[3];
          const endHour = timeMatch[4];
          const endPeriod = timeMatch[6];
          const description = timeMatch[7];
          schedule[currentDay].push({
            startHour: convertTo24Hour(parseInt(startHour), startPeriod),
            endHour: convertTo24Hour(parseInt(endHour), endPeriod),
            description: description.trim()
          });
        }
      }
    });
    
    return schedule;
  };
  
  const scheduleData = parseSchedule();
  
  const getBlockInfo = (day, hour24) => {
    const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
    const pending = courses.flatMap(c => c.assignments.filter(a => a.status !== 'completed')).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    if (scheduleData[dayName]) {
      for (const event of scheduleData[dayName]) {
        if (hour24 >= event.startHour && hour24 < event.endHour) {
          const desc = event.description.toLowerCase();
          let type = 'free';
          if (desc.includes('class') || desc.includes('lecture') || /[A-Z]{2,4}\s*\d{3}/.test(event.description)) {
            type = 'class';
          } else if (desc.includes('study') || desc.includes('work')) {
            type = 'study';
          } else if (desc.includes('office')) {
            type = 'office';
          }
          
          let detail = event.description;
          if (type === 'study' && pending.length > 0) {
            const urgentAssignments = pending.filter(a => {
              const daysUntil = Math.ceil((new Date(a.dueDate) - day) / 864e5);
              return daysUntil >= 0 && daysUntil <= 7;
            });
            if (urgentAssignments.length > 0) {
              const dueDate = new Date(urgentAssignments[0].dueDate).toLocaleDateString();
              detail += '\n\n🎯 RECOMMENDED FOCUS:\n' + urgentAssignments[0].name + ' (' + urgentAssignments[0].course + ')\nDue: ' + dueDate + '\nWeight: ' + urgentAssignments[0].weight + '%';
            }
          }
          
          // A fixed class or office commitment always takes priority over an AI suggestion for the same slot.
          return { 
            type, 
            label: event.description.split('-')[0].trim().substring(0, 20),
            detail 
          };
        }
      }
    }

    // No fixed commitment in this slot — check if the AI recommended a study block here.
    const dayKey = day.toDateString();
    const aiBlocks = aiBlocksByDate[dayKey] || [];
    const aiMatch = aiBlocks.find(b => hour24 >= b.startHour && hour24 < b.endHour);
    if (aiMatch) {
      return {
        type: 'recommended',
        label: '✨ ' + aiMatch.task.substring(0, 18),
        detail: 'Recommended: ' + aiMatch.task + '\n' + aiMatch.time
      };
    }
    
    return { type: 'free', label: '', detail: '' };
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={() => setSelectedWeek(Math.max(-8, selectedWeek - 1))} disabled={selectedWeek === -8} className="bg-purple-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-all hover:scale-105">← Prev</button>
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-bold text-white">Week of {currentWeekStart.toLocaleDateString()}</h3>
          {selectedWeek !== 0 && (
            <button onClick={() => setSelectedWeek(0)} className="text-xs text-purple-300 hover:text-white underline mt-1">Jump to This Week</button>
          )}
        </div>
        <button onClick={() => setSelectedWeek(Math.min(16, selectedWeek + 1))} disabled={selectedWeek === 16} className="bg-purple-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-all hover:scale-105">Next →</button>
      </div>

      {recommendedThisWeek && (
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
          <p className="text-amber-200 font-semibold text-sm mb-2">✨ Recommended focus for {recommendedThisWeek.week}</p>
          <div className="flex flex-wrap gap-2">
            {(recommendedThisWeek.tasks || []).map((t, i) => (
              <span key={i} className="text-xs bg-amber-500/20 text-amber-100 px-2.5 py-1 rounded-full border border-amber-400/30">{t}</span>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20 overflow-x-auto">
        <div className="grid grid-cols-8 gap-1 min-w-[1400px]">
          <div className="text-purple-300 text-xs font-bold p-2">Time</div>
          {days.map((day, i) => {
            const dueToday = getAssignmentsForDay(day);
            const isToday = day.toDateString() === todayDate.toDateString();
            return (
              <div key={i} className={'text-center p-2 rounded-lg' + (isToday ? ' bg-purple-500/15 ring-1 ring-inset ring-purple-400/50' : '')}>
                <div className={'font-bold ' + (isToday ? 'text-purple-200' : 'text-white')}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  {isToday && <span className="ml-1.5 text-[10px] align-middle bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                </div>
                <div className="text-xs text-purple-300">{day.getMonth() + 1 + '/' + day.getDate()}</div>
                {dueToday.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {dueToday.map((a, j) => {
                      const assignmentId = 'due-' + i + '-' + j;
                      return (
                        <div 
                          key={j} 
                          className="relative group"
                          onMouseEnter={() => setHoveredBlock(assignmentId)}
                          onMouseLeave={() => setHoveredBlock(null)}
                        >
                          <div className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold cursor-pointer hover:bg-red-500 transition-all">
                            DUE: {a.name.slice(0, 15)}
                          </div>
                          {hoveredBlock === assignmentId && (
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-gray-900 border-2 border-red-500 rounded-lg p-3 shadow-2xl z-50">
                              <p className="text-red-400 font-bold text-sm mb-2">{a.name}</p>
                              <p className="text-white text-xs mb-1">Course: {a.course}</p>
                              <p className="text-white text-xs mb-1">Weight: {a.weight}%</p>
                              <p className="text-white text-xs">Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 border-l-2 border-t-2 border-red-500 rotate-45"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          {timeBlocks.map((time, timeIdx) => {
            const hour24 = timeIdx + 8;
            return (
              <React.Fragment key={timeIdx}>
                <div className="text-xs text-purple-300 p-2 flex items-center">{time}</div>
                {days.map((day, dayIdx) => {
                  const blockInfo = getBlockInfo(day, hour24);
                  const blockId = dayIdx + '-' + timeIdx;
                  
                  const blockClass = 'min-h-[70px] p-2 rounded border-2 transition-all duration-200 cursor-pointer relative ' + (
                    blockInfo.type === 'class' ? 'bg-blue-600/30 border-blue-400 hover:bg-blue-600/50' :
                    blockInfo.type === 'study' ? 'bg-green-600/30 border-green-400 hover:bg-green-600/50' :
                    blockInfo.type === 'office' ? 'bg-purple-600/30 border-purple-400 hover:bg-purple-600/50' :
                    blockInfo.type === 'recommended' ? 'bg-amber-500/25 border-amber-400 border-dashed hover:bg-amber-500/40' :
                    'bg-white/5 border-purple-500/10 hover:bg-white/10'
                  ) + (hoveredBlock === blockId ? ' scale-105 z-10 shadow-2xl' : '');
                  
                  return (
                    <div
                      key={dayIdx}
                      className={blockClass}
                      onMouseEnter={() => setHoveredBlock(blockId)}
                      onMouseLeave={() => setHoveredBlock(null)}
                    >
                      {blockInfo.label && (
                        <div className="text-xs font-bold text-white text-center">{blockInfo.label}</div>
                      )}
                      {hoveredBlock === blockId && blockInfo.detail && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-gray-900 border-2 border-white/50 rounded-lg p-3 shadow-2xl z-50">
                          <p className="text-white text-xs leading-relaxed whitespace-pre-wrap">{blockInfo.detail}</p>
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 border-l-2 border-t-2 border-white/50 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      <div className="flex gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-600/30 border-2 border-blue-400 rounded"></div>
          <span className="text-purple-300">Classes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-600/30 border-2 border-green-400 rounded"></div>
          <span className="text-purple-300">Study Blocks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-purple-600/30 border-2 border-purple-400 rounded"></div>
          <span className="text-purple-300">Office Hours</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-600 rounded"></div>
          <span className="text-purple-300">Due Dates</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-amber-500/25 border-2 border-dashed border-amber-400 rounded"></div>
          <span className="text-purple-300">AI Recommended</span>
        </div>
      </div>
    </div>
  );
}
