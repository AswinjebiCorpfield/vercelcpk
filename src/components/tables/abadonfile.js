// {/* <Box sx={{ flexGrow: 1 }}>
        
// <Stack direction="column" sx={{ width: '100%' }}>
// <Typography variant="h3" sx={{ backgroundColor: 'darkblue', width: '100%', textAlign: 'center' }}>
//   Welcome to subsample distribution!
// </Typography>
// <Stack direction="row" sx={{ width: '100%' }}>
//   <Stack direction="column" sx={{ flexGrow: 1 }}>
//     <Grid container direction="column" xs={12} sx={{ backgroundColor: 'lightgray' }}>
//       {/* <Typography>Hello word!</Typography> */}
//       <Grid item>
//         <Stack direction="row">
//         <Typography sx={{ pr:2 }}>
//           Period: <br />
//           Dept: <br />
//           MachineId: <br />
//           MaterialDesc: <br />
//           DimensionDesc: <br />
//           CAT: <br />
//           No Of Data: 
//       </Typography>
//       <Typography sx={{ pr:2 }}>
//           {row?.Period} <br />
//           {row?.Dept} <br />
//           {row?.MachineId} <br />
//           {row?.MaterialDesc} <br />
//           {row?.DimensionDesc} <br />
//           {row?.CAT} <br />
//           {row?.NO_OF_DATA}
//       </Typography>
//           {/* <Typography sx={{ backgroundColor: 'darkblue' }}>O Lots Distribution & CPK Info</Typography>
//           <Typography>DATA</Typography> */}
//       {tableData.length > 0 && (
//           <>
//               <Typography sx={{ pr:2 }}>
//                   Mean: <br />
//                   STD: <br />
//                   LSL: <br />
//                   USL: <br />
//                   CPK: <br />
//                   PPK: <br />
//                   CP: <br />
//                   PP: <br />
//               </Typography>
//               <Typography sx={{ pr:2 }}>
//                   {tableData[0].MeanValue} <br />
//                   {tableData[0].StdValue} <br />
//                   {tableData[0].LSL} <br />
//                   {tableData[0].USL} <br />
//                   {row?.CPK} <br />
//                   {row?.PPK} <br />
//                   {row?.CP} <br />
//                   {row?.PP} <br />
//               </Typography>
//           </>
//       )}
//   </Stack>
//       </Grid>
//     </Grid>
//     <Grid container direction="column" xs={12} sx={{ backgroundColor: 'blue' }}>
//         {tableData.length > 0 && (
//               <>
//           <HistogramComponent
//           tableData={tableData}
//           LSL={tableData[0].LSL}
//           USL={tableData[0].USL}/>
//           </>
//         )}
//     </Grid>
//   </Stack>
//   <Box>
//     Hello world!
//             <div>
//               <Typography variant="h4" gutterBottom>
//                 Overall Lots Distribution Table
//               </Typography>
//               {loading ? (
//                 <CircularProgress />
//               ) : (
//                 <TableContainer component={Paper}>
//                   <Table>
//                     <TableHead>
//                       <TableRow>
//                         <TableCell>
//                           <strong>LotNo</strong>
//                         </TableCell>
//                         <TableCell>
//                           <strong>SubSampleNo</strong>
//                         </TableCell>
//                         <TableCell>
//                           <strong>MeasValue</strong>
//                         </TableCell>
//                         <TableCell>
//                           <strong>MeasDate</strong>
//                         </TableCell>
//                       </TableRow>
//                     </TableHead>
//                     <TableBody>
//                       {tableData.length > 0 ? (
//                         tableData.map((item, index) => (
//                           <TableRow key={index}>
//                             <TableCell>{item.LotNo}</TableCell>
//                             <TableCell>{item.SubSampleNo}</TableCell>
//                             <TableCell>{item.MeasValue}</TableCell>
//                             <TableCell>{item.MeasDate}</TableCell>
//                           </TableRow>
//                         ))
//                       ) : (
//                         <TableRow>
//                           <TableCell colSpan={4} align="center">
//                             No data available
//                           </TableCell>
//                         </TableRow>
//                       )}
//                     </TableBody>
//                   </Table>
//                 </TableContainer>
//               )}
//             </div>
//           </Box>
// </Stack>
// </Stack> */}