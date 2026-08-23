'use client';
import { TabsDemo } from '@/components/custom/Tabs/TabsDemo';
import DescriptionCareerDevelopment from '@/components/pages/Services/Career-Development/descriptionProgramCareer';
import DescriptionMentoring from '@/components/pages/Services/Mentoring/descriptionProgramMentoring';
import DescriptionProgramDevelopment from '@/components/pages/Services/Program-Development/descriptionProgramDevelopment';
import { Tabs } from '@/components/ui/tabs';
import DescriptionOrganization from '@/components/pages/Services/Organizational-Development/descriptionProgramOrganization';
import DescriptionMeeting from '@/components/pages/Services/Meeting-Streaming/descriptionProgramMeeting';
import { useSearchParams } from 'next/navigation';
import DescriptionProgramEventOrganizer from '@/components/pages/Services/Event-Specialist/descriptionProgramEventOrganizer';
import DetailMeeting from '@/components/pages/Services/Meeting-Streaming/detailMeeting';
import { Suspense, useState } from 'react';

function ServicesContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('tab');

    const [sectionHeight, setSectionHeight] = useState<string>("md:h-[50rem]");
    const [sectionHeightForMobile, setSectionHeightForMobile] = useState<string>("h-[105rem]");

  const tabs = [
    {
      title: 'Event Organizer',
      value: 'event-specialist',
      content: <DescriptionProgramEventOrganizer />,
    },
    {
      title: 'Meeting and Streaming',
      value: 'meeting-streaming',
      content: <DescriptionMeeting />,
    },
    {
      title: 'Program Development',
      value: 'program-development',
      content: <DescriptionProgramDevelopment />,
    },
    {
      title: 'Organizational Development',
      value: 'organizational-development',
      content: <DescriptionOrganization />,
    },
    {
      title: 'Mentoring',
      value: 'mentoring',
      content: <DescriptionMentoring />,
    },
  ];

  if (query === 'zoom') return <DetailMeeting />;

   const handleTabChange = (tabTitle: string) => {
      if(tabTitle === "Program Development") { setSectionHeight("md:h-[50rem]") } else setSectionHeight('md:h-[50rem]')
      if(tabTitle === "Program Development") { setSectionHeightForMobile("h-[75rem]") } else setSectionHeightForMobile('h-[105rem]')
      if(tabTitle === "Meeting and Streaming") setSectionHeightForMobile("h-[83rem]")
    };

  return (
    <section className={`${sectionHeightForMobile} ${sectionHeight} [perspective:1000px] flex flex-col max-w-[90rem] mx-auto w-full items-start justify-start mt-10 mb-40`}>
        <Tabs 
          tabs={tabs} 
          contentClassName="mt-[3rem]" 
          containerClassName='text-xs md:text-[17px] pb-[2rem] md:pb-0'
          activeTabClassName="bg-secondary" 
          tabClassName="bg-white text-primary gap-2" 
          onTabChange={handleTabChange} 
          />
    </section>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesContent />
    </Suspense>
  );
}
