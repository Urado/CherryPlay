using System.ComponentModel.DataAnnotations;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record TransitionPartyLifecycleDto(
    [property: Required] PartyLifecycleState PartyLifecycleState);
