import { useState, useEffect } from 'react';

export const useCustomBreakpoints = () => {
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isCourtsSingleColumn, setIsCourtsSingleColumn] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsHeaderCompact(width < 1000);
      setIsCourtsSingleColumn(width < 1366);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isHeaderCompact, isCourtsSingleColumn };
};
