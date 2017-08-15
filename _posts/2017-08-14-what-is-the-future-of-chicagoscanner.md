---
layout: post
title: "What is the future of #ChicagoScanner?"
date: 2017-08-14 12:00
author: Eric Tendian
comments: true
---

FCC radio license applications approved on July 14th suggest the City of Chicago is planning to undergo a major effort to modernize and consolidate the city's radio communication systems as soon as September of this year. Motorola Solutions was awarded a [$25 million, 5-year contract](https://drive.google.com/file/d/0B1zT9psBt9XENUZSZmJ4TVdXT0k/view?usp=sharing) in early 2016 to provide the city with new radio equipment, potentially for the system upgrades.

In an application to the FCC for allocating new radio frequencies, the Office of Emergency Management and Communications (OEMC) included a document ["Public Safety Radio System Justification for an Extended Implementation Period"](https://wireless2.fcc.gov/UlsEntry/attachments/attachmentViewRD.jsp?applType=search&fileKey=22748456&attachmentKey=20159234&attachmentInd=applAttach), created on May 25th, which discusses a plan to "consolidate five different trunked systems in the city into one interoperable network." The document discusses the new digital radio network would be used by the Chicago Police Department, Chicago Fire Department, Water Dept., Public Works, Park District, Aviation, and other city departments. There is no mention of encryption, though digital systems are much easier to encrypt (could be as easy as flipping a switch).

What do all these terms mean? Don't worry, we will discuss this after going into the reasoning for developing this plan.

### Why the new radio system?

While the application was received by the FCC on June 2nd, the plan potentially has been in development for much longer due to multiple factors. The document cites three specific reasons:

> 1. to bring together several disparate systems;
> 2. to combat the amount of unauthorized transmissions on our current channels;
> 3. to provide a path for our transition from the T-Band as mandated by the Federal government

Let's unpack what's behind each of those reasons:

*First reason:* Chicago currently operates multiple radio systems, such as ones at O'Hare and Midway airports which allow Department of Aviation personnel to communicate with each other, in addition to various systems for the Chicago Police and Fire departments. Consolidating the systems would mean both CPD, CFD, Dept. of Aviation, and other agencies would operate on the same set of radio frequencies, and potentially make it easier to maintain as there's less systems involved.

*Second reason:* Unauthorized transmissions have become a more frequent problem for Chicago public safety radio, with [multiple](http://abc7chicago.com/news/racial-slur-broadcast-on-chicago-police-radio-for-2nd-time/1256396/) [reports](http://www.chicagotribune.com/news/local/breaking/ct-racist-police-radio-traffic-20160314-story.html) in the past few years of inappropriate comments being broadcast. This particularly plagues the CPD radio system with all radio channels operating in the same manner as an average walkie-talkie, thus allowing anyone to buy a $30 radio on the internet and program it to transmit on police frequencies. CFD uses a [digital system](http://www.scannermasterblog.com/scanner-tip-it-is-a-digital-world/), requiring more effort and specialized equipment to transmit audio.

*Third reason:* The transition from "T-Band" is due to legislation that requires public safety agencies to relocate away from the radio spectrum in the 470-512MHz range by around 2021. This is problematic particularly for Chicago, as the Fire Department and other city agencies operate on radio frequencies within that range. There is not currently many alternatives as radio spectrum has become quite crowded, particularly in such urban areas. Using already allocated frequencies can help give a radio system the bandwidth it needs to support thousands of users.

### Who/what will be contained in the new radio system?

The type of system that the City applied to develop is a "trunking" radio system, which allows for more communication channels to be squeezed into a smaller number of radio frequencies. In a trunking system, a computer controls what radio frequencies will hold which conversations - this functions differently than a "conventional" channel which has a frequency dedicated for a specific purpose (e.g. CPD Zone 6 radio). Visit ["How does trunking work?"](http://www.taitradioacademy.com/topic/how-does-trunking-work-1/) to learn more about the basics of trunking. The system will also use P25 [digital modulation](http://www.scannermasterblog.com/scanner-tip-it-is-a-digital-world/), that will change how the audio sounds and is processed by the radios/scanners.

Chicago has a few different trunked radio systems that would be combined in this plan:

- [Chicago Public Safety and Services](http://www.radioreference.com/apps/db/?sid=581) (used by CPD Marine Unit)
- [Chicago O'Hare Airport Public Safety](http://www.radioreference.com/apps/db/?sid=583)
- [Chicago O'Hare Airport Operations](http://www.radioreference.com/apps/db/?sid=3026)
- [Chicago Midway Airport -- Department of Aviation - UHF-T](http://www.radioreference.com/apps/db/?sid=2374)

Additionally, the following departments will have their conventional radio channels brought into the new radio system:

- Chicago Police Department
- Chicago Fire Department
- Chicago Department of Transportation
- Chicago Park District
- Chicago Public Works

The new radio system can be found on RadioReference as [Chicago Office of Emergency Management and Communications - 800 MHz](http://www.radioreference.com/apps/db/?sid=9499). Continue to check that page to monitor its development.

### How does this impact scanner listeners?

For scanner listeners wanting to monitor the new system, they would be required to upgrade to a digital scanner with P25 Phase II and trunking support. A [list of compatible scanners](http://www.scannermaster.com/Digital_P25_Phase_II_Scanners_s/708.htm) can be found on the ScannerMaster website, all of which are over $300. As the system will be P25 Simulcast, the [Unication G4/G5 pagers](http://www.unicationusa.com/g5-p25-voice-pager) will also work, and may produce better reception. Older scanners and two-way radios not authorized on the trunking system will no longer work. Any Broadcastify streams of CPD radio traffic will need to have equipment upgraded to monitor the new frequencies.

Reception is another big question, as the 700/800MHz band has different propagation characteristics than the UHF (460MHz) radio scanner listeners are used to. Antennas that work for UHF will not work as well for 700/800MHz, so it may be harder to pick up the new radio system. Due to the higher frequency, there will be a faster decrease in signal strength as the listener moves away from the transmitter. Additionally, digital audio is less forgiving than analog, so there could be a higher potential for lost transmissions on scanners.

For CrimeIsDown, we will be able to continue our recordings of CPD radio traffic and potentially bring other radio traffic, as long as the hardware and software we have available is able to keep up with the new radio system. We have been able to [successfully monitor the STARCOM21 radio system](https://www.youtube.com/watch?v=Is4hu1aymN8) for State Police traffic - this radio system is quite similar to the one currently planned. However, there is the possibility the size of the new system will require many new Software-Defined Radios and antennas, a significant cost. (By [becoming a patron of CrimeIsDown](https://www.patreon.com/EricTendian), you can help support our recording and online scanner tools efforts!)

### Will communications be encrypted? What can scanner listeners do to prevent total encryption and keep the hobby alive?

The caveat which could threaten listening to Chicago public safety scanner traffic as we know it - implementation of encryption. If it is implemented, will it be on tactical frequencies only, or dispatch as well? [What would be left to listen to if encryption does occur?](http://www.scannermasterblog.com/what-to-do-with-my-scanner-when-the-cops-go-to-encryption/) The only recent case of encryption was to the Mayor's security detail channel back in 2015, known as TG352. In the City of Chicago's recent [RFP for radios](https://drive.google.com/file/d/0B1zT9psBt9XEOE5HaHQyVnpEalU/view?usp=sharing), the specification for a public safety radio does include the capability for encryption (see page 28 of the RFP), however it is not clear if that will be turned on. Many answers to these questions will come a few years from now when the system is in the midst of being implemented.

Regardless of what Chicago decides, many people have already spoken out against encryption of police radio and its effects. One news website that reports on breaking news in the Arlington Heights area published an article discussing the downsides of enabling encryption: [Police Radio Encryption: Not Secure, A Transparency Failure, A Public Safety Nightmare](http://www.arlingtoncardinal.com/2012/12/police-radio-encryption-not-secure-a-transparency-failure-a-public-safety-nightmare/).

However, many Illinois cities and towns have already begun encrypting radio traffic, such as [various Chicago suburbs](http://www.arlingtoncardinal.com/2013/02/59465/) and [Rockford, IL](http://www.wifr.com/content/news/Rockford-Police-to-Implement-Radio-Channel-Encryption-to-Improve-Police-Officer-Safety-Public-Privacy-Rights-and-Crime-Fighting-384319521.html). If encryption does occur, often it is not on all channels - read the article ["What to do with my scanner when the cops go to encryption?"](http://www.scannermasterblog.com/what-to-do-with-my-scanner-when-the-cops-go-to-encryption/) by the former president of CARMA.

Going forward, scanner listeners who want to preserve the hobby are encouraged to contact their elected officials and petition against encryption. Such activism should be started early, before plans on what to encrypt are finalized.

### Will this actually happen?

*Will this new radio system actually get developed?* This is a massive project, easily being tens of millions of dollars. To upgrade CFD to digital radio, it took $23 million and 6 years for Motorola and the City to make the switch. The timeline proposed is a little less than 4 years with thousands more users. In March 2016, Motorola Solutions was awarded a [$25 million contract for "Radio Equipment, Parts and Services"](https://drive.google.com/file/d/0B1zT9psBt9XENUZSZmJ4TVdXT0k/view?usp=sharing) (see page 87-97 for scope of work), which spans five years, though it can be extended for an additional three.

*Will radios need to be upgraded? Yes:* Radios used for public safety usually can only support a certain frequency range, in Chicago's case many of the radios only work with the 450-512MHz (UHF) range. CPD and CFD already have a few dual-band radios for special units, but most of CPD uses Motorola radios that only work with UHF. In order to upgrade both CPD, CFD, and other agencies to a new consolidated radio system on the 800MHz band, thousands of new radios will have to be purchased. The contract with Motorola seems to include the purchase of over 5,500 new radios, 2,000 of them being "Public Safety Grade", according to a [RFP specification](https://drive.google.com/file/d/0B1zT9psBt9XEOE5HaHQyVnpEalU/view?usp=sharing) published in late 2014 for the OEMC (see page 26-31). These radios will be from Motorola's APX line, designed with all the newest public safety radio features such as Over-the-Air-Programming which may reduce time spent updating radios with new configuration.

**CrimeIsDown.com will continue to have updates on this new radio system as we learn about it further, particularly any more accurate information on when main CPD and CFD dispatch will transition to the new system. We plan to [tweet out](https://twitter.com/CrimeIsDown) small updates and audio clips as we have them, and longer updates will come via blog posts such as this one. Follow us to stay in the loop!**
