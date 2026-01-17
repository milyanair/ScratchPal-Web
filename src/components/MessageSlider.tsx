import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SliderMessage } from '@/types';
import { useEffect, useState } from 'react';

export function MessageSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: messages = [] } = useQuery({
    queryKey: ['sliderMessages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slider_messages')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as SliderMessage[];
    },
  });

  useEffect(() => {
    if (messages.length === 0) return;

    const currentMessage = messages[currentIndex];
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, currentMessage?.duration || 5000);

    return () => clearInterval(timer);
  }, [currentIndex, messages]);

  if (messages.length === 0) return null;

  const currentMessage = messages[currentIndex];

  return (
    <div className="bg-gray-200 rounded-xl mx-4 py-[18px] px-4 text-center overflow-hidden min-h-[150px] md:min-h-0 flex items-center justify-center">
      <div
        key={currentIndex}
        className={`animate-in ${
          currentMessage.transition_type === 'fade'
            ? 'fade-in'
            : currentMessage.transition_type === 'zoom'
            ? 'zoom-in'
            : currentMessage.transition_type === 'slide'
            ? 'slide-in-from-right'
            : 'flip-in'
        } duration-500`}
      >
        <p className="text-sm font-medium text-gray-800">{currentMessage.message}</p>
      </div>
    </div>
  );
}
