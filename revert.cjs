const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/blue-500/g, 'emerald-500');
content = content.replace(/blue-600/g, 'emerald-600');
content = content.replace(/blue-700/g, 'emerald-700');
content = content.replace(/blue-100/g, 'emerald-100');
content = content.replace(/blue-200/g, 'emerald-200');
content = content.replace(/blue-50/g, 'emerald-50');
content = content.replace(/blue-400/g, 'emerald-400');

content = content.replace(/bg-slate-900/g, 'bg-[#F8F9FA]');
content = content.replace(/bg-slate-800\/80/g, 'bg-white/80');
content = content.replace(/bg-slate-800\/90/g, 'bg-white/90');
content = content.replace(/bg-slate-800\/50/g, 'bg-[#F9FAFB]');
content = content.replace(/bg-slate-800/g, 'bg-white');
content = content.replace(/bg-slate-700\/50/g, 'bg-[#F3F4F6]');
content = content.replace(/bg-slate-700/g, 'bg-[#F3F4F6]');
content = content.replace(/border-slate-700\/50/g, 'border-[#E5E7EB]');
content = content.replace(/border-slate-700/g, 'border-[#E5E7EB]');

content = content.replace(/text-slate-400/g, 'text-[#9CA3AF]');
content = content.replace(/text-slate-300/g, 'text-[#6B7280]');

content = content.replace(/text-white font-sans/g, 'text-[#1A1A1A] font-sans');

fs.writeFileSync('src/App.tsx', content);
console.log('Reverted colors');
